import type { FastifyInstance } from "fastify";

export default async function userRoutes(fastify: FastifyInstance) {
  // GET /me — returns the authenticated user's record from the database
  fastify.get(
    "/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { userId } = request.user;

      const [user] = await fastify.db`
        SELECT id, clerk_id, email, first_name, last_name, image_url, created_at, updated_at
        FROM users
        WHERE clerk_id = ${userId}
      `;

      if (!user) {
        return reply.code(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "User not found",
        });
      }

      return user;
    }
  );

  // POST /users/sync — syncs the Clerk user data into the local database
  fastify.post(
    "/users/sync",
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const { userId } = request.user;

      // Fetch full user details from Clerk
      const clerkUser = await fastify.clerk.users.getUser(userId);

      const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
      const firstName = clerkUser.firstName;
      const lastName = clerkUser.lastName;
      const imageUrl = clerkUser.imageUrl;

      // Upsert into the users table
      const [user] = await fastify.db`
        INSERT INTO users (clerk_id, email, first_name, last_name, image_url)
        VALUES (${userId}, ${email}, ${firstName}, ${lastName}, ${imageUrl})
        ON CONFLICT (clerk_id) DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          image_url = EXCLUDED.image_url,
          updated_at = NOW()
        RETURNING id, clerk_id, email, first_name, last_name, image_url, created_at, updated_at
      `;

      return user;
    }
  );
}
