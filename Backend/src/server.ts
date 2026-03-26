import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";

import authPlugin from "./plugins/auth.js";
import dbPlugin from "./plugins/db.js";
import healthRoutes from "./routes/health.js";
import userRoutes from "./routes/users.js";
import nominationRoutes from "./routes/nominations.js";
import votingRoutes from "./routes/voting.js";
import bookRoutes from "./routes/books.js";
import currentlyReadingRoutes from "./routes/currently-reading.js";
import meetingRoutes from "./routes/meetings.js";

const fastify = Fastify({
  logger: true,
});

// --- Register plugins ---

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
});

await fastify.register(sensible);

await fastify.register(authPlugin);
await fastify.register(dbPlugin);

// --- Register routes ---

await fastify.register(healthRoutes);
await fastify.register(userRoutes);
await fastify.register(nominationRoutes);
await fastify.register(votingRoutes);
await fastify.register(bookRoutes);
await fastify.register(currentlyReadingRoutes);
await fastify.register(meetingRoutes);

// --- Start server ---

const port = Number(process.env.API_PORT) || 4000;

try {
  await fastify.listen({ port, host: "0.0.0.0" });
  fastify.log.info(`Server listening on http://0.0.0.0:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// --- Graceful shutdown ---

const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
  await fastify.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
