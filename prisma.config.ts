import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env first, then override with .env.local (Next.js convention).
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use DIRECT_URL for migrations (bypasses pgbouncer).
    // Falls back to DATABASE_URL if DIRECT_URL is not set.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
