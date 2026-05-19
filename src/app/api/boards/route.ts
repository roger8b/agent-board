import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => svc.listBoards());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return handle(async () => {
    if (!body?.name) throw new Error("name required");
    return svc.createBoard(String(body.name), body.prefix ? String(body.prefix) : undefined);
  });
}
