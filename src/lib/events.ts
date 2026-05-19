export type SSEEvent = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
};

type Subscriber = (e: SSEEvent) => void;

const g = globalThis as unknown as { __sseSubs?: Set<Subscriber> };
const subs: Set<Subscriber> = (g.__sseSubs ??= new Set());

export function subscribe(fn: Subscriber): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function emit(type: string, data: Record<string, unknown>) {
  const e: SSEEvent = { type, data, timestamp: new Date().toISOString() };
  for (const fn of subs) {
    try {
      fn(e);
    } catch {
      // ignore broken subscriber
    }
  }
}
