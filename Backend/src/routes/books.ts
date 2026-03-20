import type { FastifyInstance } from "fastify";

export default async function bookRoutes(fastify: FastifyInstance) {
  // GET /books/cover?title=X&author=Y
  // Searches Open Library and returns a cover image URL.
  fastify.get(
    "/books/cover",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { title, author } = request.query as {
        title?: string;
        author?: string;
      };

      if (!title) {
        return reply.badRequest("title query parameter is required");
      }

      try {
        const params = new URLSearchParams({
          title,
          limit: "1",
          fields: "cover_i",
        });

        if (author) {
          params.set("author", author);
        }

        const response = await fetch(
          `https://openlibrary.org/search.json?${params}`
        );

        if (!response.ok) {
          return { cover_url: null };
        }

        const data = (await response.json()) as {
          docs: Array<{ cover_i?: number }>;
        };

        const coverId = data.docs?.[0]?.cover_i;

        if (!coverId) {
          return { cover_url: null };
        }

        return {
          cover_url: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
        };
      } catch {
        return { cover_url: null };
      }
    }
  );
}
