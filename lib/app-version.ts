import { readFile } from "node:fs/promises";
import { join } from "node:path";

let version: Promise<string | null> | undefined;
/** Each production build has a stable ID; development has no reload prompt. */
export function appVersion() {
  return (version ??= readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8")
    .then((value) => value.trim() || null)
    .catch(() => null));
}
