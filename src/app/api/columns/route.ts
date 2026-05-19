import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const boardId = new URL(req.url).searchParams.get("boardId");
  return handle(async () => {
    const id = boardId ?? (await svc.getDefaultBoard())?.id;
    if (!id) throw new Error("boardId required");
    return svc.listColumns(id);
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    const boardId = body?.boardId ?? (await svc.getDefaultBoard())?.id;
    if (!boardId) throw new Error("boardId required");
    if (!body?.name) throw new Error("name required");
    return svc.createColumn(String(boardId), String(body.name), body.color);
  });
}
