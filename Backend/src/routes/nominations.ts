import type { FastifyInstance } from "fastify";

export default async function nominationRoutes(fastify: FastifyInstance) {
  // GET /nomination-windows/current
  // Returns the most recent nomination window (active or closed) and its nominations.
  fastify.get(
    "/nomination-windows/current",
    { preHandler: fastify.authenticate },
    async (_request, _reply) => {
      const [window] = await fastify.db`
        SELECT id, opened_by, deadline, created_at,
               deadline > NOW() AS is_active
        FROM nomination_windows
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!window) {
        return { window: null, nominations: [] };
      }

      const nominations = await fastify.db`
        SELECT
          n.id,
          n.title,
          n.author,
          n.summary,
          n.pitch,
          n.created_at,
          u.clerk_id AS nominated_by_clerk_id,
          u.first_name,
          u.last_name
        FROM nominations n
        JOIN users u ON n.nominated_by = u.id
        WHERE n.window_id = ${window.id}
        ORDER BY n.created_at ASC
      `;

      return { window, nominations };
    }
  );

  // POST /nomination-windows
  // Open a new nomination window. Fails if one is already active.
  fastify.post(
    "/nomination-windows",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { deadline } = request.body as { deadline: string };

      if (!deadline) {
        return reply.badRequest("deadline is required");
      }

      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
        return reply.badRequest("deadline must be a future date and time");
      }

      const [activeWindow] = await fastify.db`
        SELECT id FROM nomination_windows WHERE deadline > NOW() LIMIT 1
      `;

      if (activeWindow) {
        return reply.conflict("A nomination window is already active");
      }

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;

      if (!user) {
        return reply.notFound("User not found");
      }

      const [newWindow] = await fastify.db`
        INSERT INTO nomination_windows (opened_by, deadline)
        VALUES (${user.id}, ${deadlineDate})
        RETURNING id, opened_by, deadline, created_at,
                  deadline > NOW() AS is_active
      `;

      return { window: newWindow, nominations: [] };
    }
  );

  // POST /nominations
  // Submit a nomination for the currently active window.
  // Each user may only submit one nomination per window.
  fastify.post(
    "/nominations",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { title, author, summary, pitch } = request.body as {
        title: string;
        author: string;
        summary: string;
        pitch?: string;
      };

      if (!title || !author || !summary) {
        return reply.badRequest("title, author, and summary are required");
      }

      const [activeWindow] = await fastify.db`
        SELECT id FROM nomination_windows
        WHERE deadline > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!activeWindow) {
        return reply.notFound("No active nomination window");
      }

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;

      if (!user) {
        return reply.notFound("User not found");
      }

      const [existing] = await fastify.db`
        SELECT id FROM nominations
        WHERE window_id = ${activeWindow.id} AND nominated_by = ${user.id}
      `;

      if (existing) {
        return reply.conflict(
          "You have already submitted a nomination for this window"
        );
      }

      const [nomination] = await fastify.db`
        INSERT INTO nominations (window_id, nominated_by, title, author, summary, pitch)
        VALUES (${activeWindow.id}, ${user.id}, ${title}, ${author}, ${summary}, ${pitch ?? null})
        RETURNING id, title, author, summary, pitch, created_at
      `;

      return nomination;
    }
  );

  // POST /nomination-windows/:id/close
  // Close the nomination window early (sets deadline to now).
  fastify.post(
    "/nomination-windows/:id/close",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM nomination_windows WHERE id = ${id} AND deadline > NOW()
      `;

      if (!window) {
        return reply.notFound("Active nomination window not found");
      }

      const [updated] = await fastify.db`
        UPDATE nomination_windows
        SET deadline = NOW() - interval '1 second'
        WHERE id = ${id}
        RETURNING id, opened_by, deadline, created_at, deadline > NOW() AS is_active
      `;

      return { window: updated };
    }
  );

  // POST /nomination-windows/:id/cancel
  // Cancel the nomination window and delete all associated nominations.
  fastify.post(
    "/nomination-windows/:id/cancel",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM nomination_windows WHERE id = ${id} AND deadline > NOW()
      `;

      if (!window) {
        return reply.notFound("Active nomination window not found");
      }

      // Delete in dependency order: votes → voting_windows → nominations → nomination_window
      await fastify.db`
        DELETE FROM votes WHERE voting_window_id IN (
          SELECT id FROM voting_windows WHERE nomination_window_id = ${id}
        )
      `;
      await fastify.db`DELETE FROM voting_windows WHERE nomination_window_id = ${id}`;
      await fastify.db`DELETE FROM nominations WHERE window_id = ${id}`;
      await fastify.db`DELETE FROM nomination_windows WHERE id = ${id}`;

      return { success: true };
    }
  );
}
