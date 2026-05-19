import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    if (!body?.targetColumnId) throw new Error("targetColumnId required");
    return svc.moveTask(id, String(body.targetColumnId), body.order);
  });
}
