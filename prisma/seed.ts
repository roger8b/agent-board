import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const dbDir = path.join(os.homedir(), ".agent-kanban");
fs.mkdirSync(dbDir, { recursive: true });
const dbUrl = `file:${path.join(dbDir, "data.db")}`;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });

const PREFIX = "PROJ"; // board id == prefix
let counter = 0; // issue counter: tasks + subtasks → PROJ-001…
let colCounter = 0; // column counter → PROJ-C1…
const nextIssueId = () => `${PREFIX}-${String(++counter).padStart(3, "0")}`;
const nextColId = () => `${PREFIX}-C${++colCounter}`;
const commentId = () => `COMMENT-${randomUUID().replace(/-/g, "").slice(0, 8)}`;

const COLUMNS = [
  { slug: "backlog", name: "Backlog", color: "#9B9A97" },
  { slug: "refinement", name: "Refinement", color: "#2383E2" },
  { slug: "development", name: "Development", color: "#7C3AED" },
  { slug: "review", name: "Review", color: "#D97706" },
  { slug: "done", name: "Done", color: "#17A34A" },
];

const TASKS: Record<string, { title: string; agent?: string }[]> = {
  backlog: [
    { title: "Analisar logs de erro do servidor de produção", agent: "analyst" },
    { title: "Criar dashboard de métricas de uso do produto", agent: "analyst" },
    { title: "Atualizar dependências do projeto para últimas versões estáveis" },
  ],
  refinement: [
    { title: "Revisar estrutura de dados do novo módulo de billing", agent: "reviewer" },
  ],
  development: [
    { title: "Implementar autenticação via OAuth no backend", agent: "coder" },
    { title: "Configurar pipeline de CI/CD para branch principal", agent: "coder" },
  ],
  review: [
    { title: "Testar integração com API de pagamentos Stripe", agent: "reviewer" },
  ],
  done: [
    { title: "Documentar endpoints da API de autenticação", agent: "analyst" },
  ],
};

async function main() {
  await prisma.comment.deleteMany();
  await prisma.subTask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.board.deleteMany();

  const boardId = PREFIX;
  await prisma.board.create({
    data: { id: boardId, name: "Quadro Kanban", prefix: PREFIX, counter: 0, colCounter: 0 },
  });

  for (let i = 0; i < COLUMNS.length; i++) {
    const c = COLUMNS[i];
    const columnId = nextColId();
    await prisma.column.create({
      data: { id: columnId, boardId, slug: c.slug, name: c.name, color: c.color, order: i },
    });
    const list = TASKS[c.slug] ?? [];
    for (let j = 0; j < list.length; j++) {
      const t = list[j];
      const taskId = nextIssueId();
      await prisma.task.create({
        data: { id: taskId, columnId, title: t.title, agent: t.agent ?? null, order: j },
      });
      if (c.slug === "backlog" && j === 0) {
        await prisma.subTask.create({
          data: { id: nextIssueId(), taskId, title: "Revisar logs de ontem", description: "Verificar ontem à noite", status: "done", done: true, order: 0 },
        });
        await prisma.subTask.create({
          data: { id: nextIssueId(), taskId, title: "Identificar padrão de erros", status: "", done: false, order: 1 },
        });
        await prisma.comment.create({
          data: { id: commentId(), taskId, author: "agent", text: "Quais logs específicos você precisa?" },
        });
      }
      if (c.slug === "development" && j === 0) {
        await prisma.comment.create({
          data: { id: commentId(), taskId, author: "user", text: "Pode usar a biblioteca passport.js." },
        });
      }
    }
  }

  // persist counters so future creations continue the sequence
  await prisma.board.update({ where: { id: boardId }, data: { counter, colCounter } });
  console.log(
    `Seed concluído. Board ${PREFIX} · tarefas/subtarefas ${PREFIX}-001..${PREFIX}-${String(counter).padStart(3, "0")} · colunas ${PREFIX}-C1..${PREFIX}-C${colCounter}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
