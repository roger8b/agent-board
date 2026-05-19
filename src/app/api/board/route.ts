import { handle } from "@/lib/http";
import * as svc from "@/lib/service";

export const dynamic = "force-dynamic";

// Convenience: full default board (single-board foundation)
export async function GET() {
  return handle(async () => {
    const b = await svc.getDefaultBoard();
    if (!b) throw new Error("not found");
    return svc.getBoard(b.id);
  });
}
