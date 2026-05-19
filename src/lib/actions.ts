"use server";

import { revalidatePath } from "next/cache";
import * as svc from "@/lib/service";

const rv = () => revalidatePath("/board");

export async function createTask(columnId: string, title: string) {
  if (!title.trim()) return;
  await svc.createTask(columnId, { title });
  rv();
}

export async function updateTask(
  id: string,
  data: { title?: string; description?: string | null; agent?: string | null },
) {
  await svc.updateTask(id, data);
  rv();
}

export async function moveTask(taskId: string, targetColumnId: string) {
  await svc.moveTask(taskId, targetColumnId);
  rv();
}

export async function deleteTask(id: string) {
  await svc.deleteTask(id);
  rv();
}

export async function createSubTask(
  taskId: string,
  data: { title: string; description?: string; status?: string },
) {
  if (!data.title.trim()) return;
  await svc.createSubTask(taskId, data);
  rv();
}

export async function updateSubTask(
  id: string,
  data: { title?: string; description?: string | null; status?: string; done?: boolean },
) {
  await svc.updateSubTask(id, data);
  rv();
}

export async function toggleSubTask(id: string) {
  await svc.toggleSubTask(id);
  rv();
}

export async function deleteSubTask(id: string) {
  await svc.deleteSubTask(id);
  rv();
}

export async function createComment(taskId: string, text: string, author = "user") {
  if (!text.trim()) return;
  await svc.createComment(taskId, text, author);
  rv();
}

export async function deleteComment(id: string) {
  await svc.deleteComment(id);
  rv();
}

export async function createColumn(boardId: string, name: string, color?: string) {
  if (!name.trim()) return;
  await svc.createColumn(boardId, name, color);
  rv();
}

export async function renameColumn(id: string, name: string) {
  if (!name.trim()) return;
  await svc.renameColumn(id, name);
  rv();
}

export async function deleteColumn(id: string) {
  await svc.deleteColumn(id);
  rv();
}
