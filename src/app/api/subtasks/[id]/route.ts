import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(() =>
    svc.updateSubTask(id, {
      title: body?.title,
      description: body?.description,
      status: body?.status,
      done: body?.done,
    }),
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    await svc.deleteSubTask(id);
    return { deleted: id };
  });
}
