import fp from "fastify-plugin";
import postgres, { type Sql } from "postgres";
import type { FastifyInstance } from "fastify";

// Module augmentation for Fastify types
declare module "fastify" {
  interface FastifyInstance {
    db: Sql;
  }
}

export default fp(
  async function dbPlugin(fastify: FastifyInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    const sql = postgres(connectionString);

    // Decorate the Fastify instance with the database connection
    fastify.decorate("db", sql);

    // Gracefully close the database connection when Fastify shuts down
    fastify.addHook("onClose", async () => {
      fastify.log.info("Closing database connection");
      await sql.end();
    });
  },
  {
    name: "db",
  }
);
