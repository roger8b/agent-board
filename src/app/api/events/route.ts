import { subscribe, type SSEEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: SSEEvent) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${e.type}\ndata: ${JSON.stringify(e.data)}\nid: ${Date.now()}\n\n`,
            ),
          );
        } catch {
          cleanup();
        }
      };

      send({ type: "connected", data: {}, timestamp: new Date().toISOString() });

      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          cleanup();
        }
      }, 30000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
