import type { FastifyInstance } from "fastify";

export default async function votingRoutes(fastify: FastifyInstance) {
  // GET /voting-windows/current
  // Returns the current voting window (linked to the most recent nomination window),
  // nominees with vote counts, and the current user's vote if any.
  fastify.get(
    "/voting-windows/current",
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const { userId } = request.user;

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;

      const [nominationWindow] = await fastify.db`
        SELECT id, deadline, deadline > NOW() AS is_active
        FROM nomination_windows
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!nominationWindow) {
        return { voting_window: null, nomination_window: null, nominees: [], user_vote: null };
      }

      const [votingWindow] = await fastify.db`
        SELECT id, nomination_window_id, opened_by, deadline, created_at,
               deadline > NOW() AS is_active
        FROM voting_windows
        WHERE nomination_window_id = ${nominationWindow.id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      // Fetch nominees regardless of whether a voting window exists yet,
      // so the "Open Voting" modal can show a summary of nominees.
      const nomineesBase = await fastify.db`
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
        WHERE n.window_id = ${nominationWindow.id}
        ORDER BY n.created_at ASC
      `;

      if (!votingWindow) {
        return {
          voting_window: null,
          nomination_window: nominationWindow,
          nominees: nomineesBase.map((n: any) => ({ ...n, vote_count: 0 })),
          user_vote: null,
        };
      }

      const nominees = await fastify.db`
        SELECT
          n.id,
          n.title,
          n.author,
          n.summary,
          n.pitch,
          n.created_at,
          u.clerk_id AS nominated_by_clerk_id,
          u.first_name,
          u.last_name,
          COUNT(v.id)::int AS vote_count
        FROM nominations n
        JOIN users u ON n.nominated_by = u.id
        LEFT JOIN votes v ON v.nomination_id = n.id AND v.voting_window_id = ${votingWindow.id}
        WHERE n.window_id = ${nominationWindow.id}
        GROUP BY n.id, u.clerk_id, u.first_name, u.last_name
        ORDER BY vote_count DESC, n.created_at ASC
      `;

      let userVote = null;
      if (user) {
        const [vote] = await fastify.db`
          SELECT nomination_id FROM votes
          WHERE voting_window_id = ${votingWindow.id} AND voter_id = ${user.id}
        `;
        userVote = vote ?? null;
      }

      return { voting_window: votingWindow, nomination_window: nominationWindow, nominees, user_vote: userVote };
    }
  );

  // POST /voting-windows
  // Open a voting window for the most recently closed nomination window.
  fastify.post(
    "/voting-windows",
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

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;
      if (!user) return reply.notFound("User not found");

      const [nominationWindow] = await fastify.db`
        SELECT id FROM nomination_windows
        WHERE deadline <= NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!nominationWindow) {
        return reply.badRequest("No closed nomination window found");
      }

      const [existingVoting] = await fastify.db`
        SELECT id FROM voting_windows
        WHERE nomination_window_id = ${nominationWindow.id}
      `;
      if (existingVoting) {
        return reply.conflict("Voting has already been opened for this nomination round");
      }

      const [newWindow] = await fastify.db`
        INSERT INTO voting_windows (nomination_window_id, opened_by, deadline)
        VALUES (${nominationWindow.id}, ${user.id}, ${deadlineDate})
        RETURNING id, nomination_window_id, opened_by, deadline, created_at,
                  deadline > NOW() AS is_active
      `;

      return { voting_window: newWindow };
    }
  );

  // POST /votes
  // Cast a vote for a nomination in the active voting window.
  fastify.post(
    "/votes",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { nomination_id } = request.body as { nomination_id: number };

      if (!nomination_id) {
        return reply.badRequest("nomination_id is required");
      }

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;
      if (!user) return reply.notFound("User not found");

      const [activeVoting] = await fastify.db`
        SELECT id, nomination_window_id FROM voting_windows
        WHERE deadline > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!activeVoting) {
        return reply.notFound("No active voting window");
      }

      const [nomination] = await fastify.db`
        SELECT id FROM nominations
        WHERE id = ${nomination_id} AND window_id = ${activeVoting.nomination_window_id}
      `;
      if (!nomination) {
        return reply.notFound("Nomination not found in active voting window");
      }

      const [existingVote] = await fastify.db`
        SELECT id FROM votes
        WHERE voting_window_id = ${activeVoting.id} AND voter_id = ${user.id}
      `;
      if (existingVote) {
        return reply.conflict("You have already voted in this window");
      }

      const [vote] = await fastify.db`
        INSERT INTO votes (voting_window_id, voter_id, nomination_id)
        VALUES (${activeVoting.id}, ${user.id}, ${nomination_id})
        RETURNING id, nomination_id, created_at
      `;

      return vote;
    }
  );

  // POST /voting-windows/:id/close
  // Close the voting window early (sets deadline to now).
  fastify.post(
    "/voting-windows/:id/close",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM voting_windows WHERE id = ${id} AND deadline > NOW()
      `;

      if (!window) {
        return reply.notFound("Active voting window not found");
      }

      const [updated] = await fastify.db`
        UPDATE voting_windows
        SET deadline = NOW() - interval '1 second'
        WHERE id = ${id}
        RETURNING id, nomination_window_id, opened_by, deadline, created_at,
                  deadline > NOW() AS is_active
      `;

      return { voting_window: updated };
    }
  );

  // DELETE /voting-windows/:id
  // Cancel the voting window and delete all votes. Returns to nominations-closed state.
  fastify.delete(
    "/voting-windows/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [window] = await fastify.db`
        SELECT id FROM voting_windows WHERE id = ${id} AND deadline > NOW()
      `;

      if (!window) {
        return reply.notFound("Active voting window not found");
      }

      await fastify.db`DELETE FROM votes WHERE voting_window_id = ${id}`;
      await fastify.db`DELETE FROM voting_windows WHERE id = ${id}`;

      return { success: true };
    }
  );
}
