import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { defineConfig, env } from "prisma/config";

const dbDir = path.join(os.homedir(), ".agent-kanban");
fs.mkdirSync(dbDir, { recursive: true });
process.env.DATABASE_URL ||= `file:${path.join(dbDir, "data.db")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
