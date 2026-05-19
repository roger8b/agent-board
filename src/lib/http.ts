export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    return ok(await fn());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    const status = msg === "not found" ? 404 : 400;
    return fail(msg, status);
  }
}
