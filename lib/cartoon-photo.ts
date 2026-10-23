import { spawn } from "node:child_process";
import { join } from "node:path";

export const cartoonVersion = "pillow-v1";
const pending = new Map<string, Promise<Buffer>>();
let active = 0;

// Coalesce requests for one photo, and bound CPU use on the Raspberry Pi.
export function generateCartoon(key: string, input: Buffer): Promise<Buffer> {
  const existing = pending.get(key);
  if (existing) return existing;
  if (active >= 2)
    return Promise.reject(
      new Error("Cartoon processor busy. Try again shortly."),
    );
  active++;
  const job = new Promise<Buffer>((resolve, reject) => {
    const child = spawn(
      "python3",
      [join(process.cwd(), "scripts/cartoon-photo.py")],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let ended = false;
    const chunks: Buffer[] = [];
    let size = 0;
    const finish = (error?: Error) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      if (error) {
        child.kill("SIGKILL");
        reject(error);
      } else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(
      () => finish(new Error("Cartoon processing timed out.")),
      15000,
    );
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024)
        finish(new Error("Cartoon output too large."));
      else chunks.push(chunk);
    });
    child.stderr.resume();
    child.stdin.on("error", () => finish(new Error("Unable to read photo.")));
    child.on("error", () =>
      finish(new Error("Python cartoon processor unavailable.")),
    );
    child.on("close", (code) => {
      const bytes = Buffer.concat(chunks);
      if (
        code !== 0 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ) {
        finish(new Error("Unable to generate cartoon."));
      } else finish();
    });
    child.stdin.end(input);
  }).finally(() => {
    active--;
    pending.delete(key);
  });
  pending.set(key, job);
  return job;
}
