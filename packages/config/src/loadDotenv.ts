import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findEnvPath(startDir: string, maxDepth: number): string | undefined {
  let dir = resolve(startDir);
  for (let i = 0; i < maxDepth; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function applyParsed(parsed: Record<string, string>): void {
  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    if (process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

/** Walks up from this package and from `cwd` to find `.env`; strips UTF-8 BOM. */
export function loadDotenv(): void {
  const fromFile = dirname(fileURLToPath(import.meta.url));
  const fromCwd = process.cwd();

  const path =
    findEnvPath(fromFile, 12) ??
    findEnvPath(fromCwd, 12);

  if (!path) {
    console.error(
      "[forge] No `.env` file found. Walked up from:\n" +
        `  - ${fromFile}\n` +
        `  - ${fromCwd}\n` +
        "Put `.env` at the repo root or in `apps/forge/`. See `.env.example`."
    );
    return;
  }

  let raw = readFileSync(path, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }

  const parsed = parse(raw);
  applyParsed(parsed);

  if (process.env.FORGE_LOG_LEVEL === "debug") {
    console.error(
      `[forge] Loaded environment from ${path} (${Object.keys(parsed).length} keys)`
    );
  }
}
