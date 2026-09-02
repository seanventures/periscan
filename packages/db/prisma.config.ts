import { defineConfig } from "prisma/config";
import { resolveDatabaseUrlFromEnv } from "./src/database-env.js";

process.env.DATABASE_URL ??= resolveDatabaseUrlFromEnv();

export default defineConfig({
  migrations: {
    seed: "tsx src/seed.ts"
  },
  schema: "prisma/schema.prisma"
});
