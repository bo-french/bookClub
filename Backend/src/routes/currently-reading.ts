import type { FastifyInstance } from "fastify";

export default async function currentlyReadingRoutes(fastify: FastifyInstance) {
  // GET /currently-reading — returns the active currently reading book (or null)
  fastify.get(
    "/currently-reading",
    { preHandler: fastify.authenticate },
    async (_request, _reply) => {
      const [book] = await fastify.db`
        SELECT
          cr.id,
          cr.title,
          cr.author,
          cr.started_at,
          u.first_name AS set_by_first_name,
          u.last_name AS set_by_last_name
        FROM currently_reading cr
        JOIN users u ON u.id = cr.set_by
        WHERE cr.is_active = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM meeting_windows mw
            JOIN meeting_options mo ON mo.id = mw.selected_option_id
            WHERE mw.selected_option_id IS NOT NULL
              AND mo.meeting_date < CURRENT_DATE
              AND mo.meeting_date >= cr.started_at::date
          )
        LIMIT 1
      `;

      return { book: book ?? null };
    }
  );

  // GET /currently-reading/comments — returns comments for the active book
  fastify.get(
    "/currently-reading/comments",
    { preHandler: fastify.authenticate },
    async (_request, reply) => {
      const [book] = await fastify.db`
        SELECT id FROM currently_reading WHERE is_active = TRUE LIMIT 1
      `;

      if (!book) {
        return { comments: [] };
      }

      const comments = await fastify.db`
        SELECT
          bc.id,
          bc.body,
          bc.created_at,
          u.first_name,
          u.last_name,
          u.image_url
        FROM book_comments bc
        JOIN users u ON u.id = bc.author_id
        WHERE bc.book_id = ${book.id}
        ORDER BY bc.created_at ASC
      `;

      return { comments };
    }
  );

  // POST /currently-reading/comments — add a comment to the active book
  fastify.post(
    "/currently-reading/comments",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { body } = request.body as { body?: string };

      if (!body || !body.trim()) {
        return reply.badRequest("body is required");
      }

      const [book] = await fastify.db`
        SELECT id FROM currently_reading WHERE is_active = TRUE LIMIT 1
      `;

      if (!book) {
        return reply.notFound("No active currently reading book");
      }

      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;

      if (!user) {
        return reply.notFound("User not found");
      }

      const [comment] = await fastify.db`
        INSERT INTO book_comments (book_id, author_id, body)
        VALUES (${book.id}, ${user.id}, ${body.trim()})
        RETURNING id, body, created_at
      `;

      const [full] = await fastify.db`
        SELECT
          bc.id,
          bc.body,
          bc.created_at,
          u.first_name,
          u.last_name,
          u.image_url
        FROM book_comments bc
        JOIN users u ON u.id = bc.author_id
        WHERE bc.id = ${comment.id}
      `;

      return { comment: full };
    }
  );

  // POST /currently-reading — set a new currently reading book (deactivates previous)
  fastify.post(
    "/currently-reading",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;
      const { title, author } = request.body as {
        title?: string;
        author?: string;
      };

      if (!title || !author) {
        return reply.badRequest("title and author are required");
      }

      // Look up the internal user id
      const [user] = await fastify.db`
        SELECT id FROM users WHERE clerk_id = ${userId}
      `;

      if (!user) {
        return reply.notFound("User not found");
      }

      // Deactivate any current book and insert the new one in a transaction
      const [book] = await fastify.db.begin(async (sql) => {
        await sql`
          UPDATE currently_reading SET is_active = FALSE WHERE is_active = TRUE
        `;

        return sql`
          INSERT INTO currently_reading (title, author, set_by)
          VALUES (${title}, ${author}, ${user.id})
          RETURNING id, title, author, started_at
        `;
      });

      return { book };
    }
  );
}
