import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const dbDir = path.join(os.homedir(), ".agent-kanban");
fs.mkdirSync(dbDir, { recursive: true });
const dbUrl = `file:${path.join(dbDir, "data.db")}`;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
