import fp from "fastify-plugin";
import { createClerkClient, verifyToken, type ClerkClient } from "@clerk/backend";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Module augmentation for Fastify types
declare module "fastify" {
  interface FastifyInstance {
    clerk: ClerkClient;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      userId: string;
      sessionId: string;
    };
  }
}

export default fp(
  async function authPlugin(fastify: FastifyInstance) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY environment variable is required");
    }

    const clerkClient = createClerkClient({ secretKey });

    // Decorate the Fastify instance with the Clerk client
    fastify.decorate("clerk", clerkClient);

    // Decorate with the authenticate preHandler
    fastify.decorate(
      "authenticate",
      async function authenticate(
        request: FastifyRequest,
        reply: FastifyReply
      ): Promise<void> {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          reply.code(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "Missing or invalid Authorization header",
          });
          return;
        }

        const token = authHeader.replace("Bearer ", "");

        try {
          const payload = await verifyToken(token, { secretKey });

          request.user = {
            userId: payload.sub,
            sessionId: payload.sid,
          };
        } catch (err) {
          request.log.warn({ err }, "Token verification failed");
          reply.code(401).send({
            statusCode: 401,
            error: "Unauthorized",
            message: "Invalid or expired token",
          });
        }
      }
    );
  },
  {
    name: "auth",
  }
);
