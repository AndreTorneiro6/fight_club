import { ensure, LeagueError } from "./rules";
export async function readLimitedBody(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  ensure(
    !Number.isFinite(declared) || declared <= limit,
    "Pedido demasiado grande.",
    413,
  );
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new LeagueError("Pedido demasiado grande.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function readJson(request: Request, limit = 65536) {
  ensure(
    request.headers.get("content-type")?.split(";")[0].trim() ===
      "application/json",
    "Envia dados em JSON.",
    415,
  );
  const body = await readLimitedBody(request, limit);
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new LeagueError("JSON inválido.", 400);
  }
}
