import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => svc.listSubTasks(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    if (!body?.title) throw new Error("title required");
    return svc.createSubTask(id, {
      title: String(body.title),
      description: body.description,
      status: body.status,
    });
  });
}
