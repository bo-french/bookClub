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
        LIMIT 1
      `;

      return { book: book ?? null };
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
