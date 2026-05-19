import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const boardId = new URL(req.url).searchParams.get("boardId");
  return handle(async () => {
    const id = boardId ?? (await svc.getDefaultBoard())?.id;
    if (!id) throw new Error("boardId required");
    return svc.listTasks(id);
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    if (!body?.columnId) throw new Error("columnId required");
    if (!body?.title) throw new Error("title required");
    return svc.createTask(String(body.columnId), {
      title: String(body.title),
      description: body.description ?? null,
      agent: body.agent ?? null,
    });
  });
}
