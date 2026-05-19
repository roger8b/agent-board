import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    if (typeof body?.order === "number") return svc.moveColumn(id, body.order);
    if (body?.name) return svc.renameColumn(id, String(body.name));
    throw new Error("name or order required");
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    await svc.deleteColumn(id);
    return { deleted: id };
  });
}
