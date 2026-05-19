import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const t = await svc.getTask(id);
    if (!t) throw new Error("not found");
    return t;
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(() =>
    svc.updateTask(id, {
      title: body?.title,
      description: body?.description,
      agent: body?.agent,
    }),
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    await svc.deleteTask(id);
    return { deleted: id };
  });
}
