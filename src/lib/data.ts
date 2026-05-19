import { prisma } from "@/lib/db";

export function listBoardsLite() {
  return prisma.board.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

export async function getBoardData(boardId?: string) {
  const board = await prisma.board.findFirst({
    where: boardId ? { id: boardId } : undefined,
    orderBy: { createdAt: "asc" },
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
  return board;
}

export type BoardData = NonNullable<Awaited<ReturnType<typeof getBoardData>>>;
export type ColumnData = BoardData["columns"][number];
export type TaskData = ColumnData["tasks"][number];
export type SubTaskData = TaskData["subtasks"][number];
export type CommentData = TaskData["comments"][number];
