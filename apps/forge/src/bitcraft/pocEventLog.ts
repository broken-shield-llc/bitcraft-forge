import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function appendPocEvent(
  path: string | undefined,
  payload: Record<string, unknown>
): void {
  if (!path) return;
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path,
      JSON.stringify({ t: new Date().toISOString(), ...payload }) + "\n"
    );
  } catch {
    void 0;
  }
}
