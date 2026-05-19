import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";

// ── Jira-style ID allocation ─────────────────────
// PREFIX is the project. The issue counter numbers tasks + subtasks
// (1st task → PREFIX-001); columns get their own PREFIX-C{n} ids; the
// board id is the prefix itself. Counters never reuse a number.
function sanitizePrefix(raw: string) {
  const p = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!p) throw new Error("invalid prefix");
  return p.slice(0, 10);
}

function formatIssueId(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

// tasks + subtasks share this per-project issue counter
async function allocIssueId(boardId: string) {
  const b = await prisma.board.update({
    where: { id: boardId },
    data: { counter: { increment: 1 } },
  });
  return formatIssueId(b.prefix, b.counter);
}

// columns are not issues — separate readable counter
async function allocColumnId(boardId: string) {
  const b = await prisma.board.update({
    where: { id: boardId },
    data: { colCounter: { increment: 1 } },
  });
  return `${b.prefix}-C${b.colCounter}`;
}

async function boardIdForColumn(columnId: string) {
  const c = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  if (!c) throw new Error("not found");
  return c.boardId;
}

async function boardIdForTask(taskId: string) {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { column: { select: { boardId: true } } },
  });
  if (!t) throw new Error("not found");
  return t.column.boardId;
}

function newCommentId() {
  return `COMMENT-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

// ── Board ────────────────────────────────────────
export function listBoards() {
  return prisma.board.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getDefaultBoard() {
  return prisma.board.findFirst({ orderBy: { createdAt: "asc" } });
}

export function getBoard(id: string) {
  return prisma.board.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            orderBy: { order: "asc" },
            include: {
              subtasks: { orderBy: { order: "asc" } },
              comments: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });
}

export async function createBoard(name: string, prefix?: string) {
  const n = name.trim();
  if (!n) throw new Error("name required");
  const p = sanitizePrefix(prefix || n);
  const board = await prisma.board.create({
    data: { id: p, name: n, prefix: p, counter: 0, colCounter: 0 },
  });
  const DEFAULT_COLUMNS = [
    { slug: "backlog", name: "Backlog", color: "#9B9A97" },
    { slug: "refinement", name: "Refinement", color: "#2383E2" },
    { slug: "development", name: "Development", color: "#7C3AED" },
    { slug: "review", name: "Review", color: "#D97706" },
    { slug: "done", name: "Done", color: "#17A34A" },
  ];
  for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
    const c = DEFAULT_COLUMNS[i];
    await prisma.column.create({
      data: { id: await allocColumnId(p), boardId: p, slug: c.slug, name: c.name, color: c.color, order: i },
    });
  }
  emit("board:created", { id: board.id, name: board.name });
  return board;
}

// ── Column ───────────────────────────────────────
export function listColumns(boardId: string) {
  return prisma.column.findMany({ where: { boardId }, orderBy: { order: "asc" } });
}

export async function createColumn(boardId: string, name: string, color = "#9B9A97") {
  const n = name.trim();
  if (!n) throw new Error("name required");
  const count = await prisma.column.count({ where: { boardId } });
  const id = await allocColumnId(boardId);
  const col = await prisma.column.create({
    data: { id, boardId, name: n, slug: `col-${Date.now()}`, color, order: count },
  });
  emit("column:created", { id: col.id, boardId });
  return col;
}

export async function renameColumn(id: string, name: string) {
  const col = await prisma.column.update({ where: { id }, data: { name: name.trim() } });
  emit("column:updated", { id });
  return col;
}

export async function moveColumn(id: string, order: number) {
  const col = await prisma.column.update({ where: { id }, data: { order } });
  emit("column:updated", { id });
  return col;
}

export async function deleteColumn(id: string) {
  const col = await prisma.column.findUnique({ where: { id } });
  if (!col) throw new Error("not found");
  const total = await prisma.column.count({ where: { boardId: col.boardId } });
  if (total <= 1) throw new Error("cannot delete last column");
  await prisma.column.delete({ where: { id } });
  emit("column:deleted", { id });
}

// ── Task ─────────────────────────────────────────
export function listTasks(boardId: string) {
  return prisma.task.findMany({
    where: { column: { boardId } },
    orderBy: [{ columnId: "asc" }, { order: "asc" }],
    include: { subtasks: true, comments: true },
  });
}

export function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      column: true,
      subtasks: { orderBy: { order: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function createTask(
  columnId: string,
  data: { title: string; description?: string | null; agent?: string | null },
) {
  const title = data.title.trim();
  if (!title) throw new Error("title required");
  const count = await prisma.task.count({ where: { columnId } });
  const id = await allocIssueId(await boardIdForColumn(columnId));
  const task = await prisma.task.create({
    data: {
      id,
      columnId,
      title,
      description: data.description?.trim() || null,
      agent: data.agent || null,
      order: count,
    },
  });
  emit("task:created", { id: task.id, columnId });
  return task;
}

export async function updateTask(
  id: string,
  data: { title?: string; description?: string | null; agent?: string | null },
) {
  const task = await prisma.task.update({ where: { id }, data });
  emit("task:updated", { id });
  return task;
}

export async function moveTask(id: string, targetColumnId: string, order?: number) {
  const ord = order ?? (await prisma.task.count({ where: { columnId: targetColumnId } }));
  const task = await prisma.task.update({
    where: { id },
    data: { columnId: targetColumnId, order: ord },
  });
  emit("task:moved", { id, toColumnId: targetColumnId, order: ord });
  return task;
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
  emit("task:deleted", { id });
}

// ── SubTask ──────────────────────────────────────
export function listSubTasks(taskId: string) {
  return prisma.subTask.findMany({ where: { taskId }, orderBy: { order: "asc" } });
}

export async function createSubTask(
  taskId: string,
  data: { title: string; description?: string; status?: string },
) {
  const title = data.title.trim();
  if (!title) throw new Error("title required");
  const count = await prisma.subTask.count({ where: { taskId } });
  const id = await allocIssueId(await boardIdForTask(taskId));
  const st = await prisma.subTask.create({
    data: {
      id,
      taskId,
      title,
      description: data.description?.trim() || null,
      status: data.status || "",
      done: data.status === "done",
      order: count,
    },
  });
  emit("subtask:created", { id: st.id, taskId });
  return st;
}

export async function updateSubTask(
  id: string,
  data: { title?: string; description?: string | null; status?: string; done?: boolean },
) {
  const st = await prisma.subTask.update({ where: { id }, data });
  emit("subtask:updated", { id });
  return st;
}

export async function toggleSubTask(id: string) {
  const st = await prisma.subTask.findUnique({ where: { id } });
  if (!st) throw new Error("not found");
  const done = !st.done;
  const updated = await prisma.subTask.update({
    where: { id },
    data: { done, status: done ? "done" : st.status === "done" ? "" : st.status },
  });
  emit("subtask:updated", { id });
  return updated;
}

export async function deleteSubTask(id: string) {
  await prisma.subTask.delete({ where: { id } });
  emit("subtask:deleted", { id });
}

// ── Comment ──────────────────────────────────────
export function listComments(taskId: string) {
  return prisma.comment.findMany({ where: { taskId }, orderBy: { createdAt: "asc" } });
}

export async function createComment(taskId: string, text: string, author = "user") {
  const t = text.trim();
  if (!t) throw new Error("text required");
  const c = await prisma.comment.create({
    data: { id: newCommentId(), taskId, text: t, author },
  });
  emit("comment:created", { id: c.id, taskId });
  return c;
}

export async function deleteComment(id: string) {
  await prisma.comment.delete({ where: { id } });
  emit("comment:deleted", { id });
}
