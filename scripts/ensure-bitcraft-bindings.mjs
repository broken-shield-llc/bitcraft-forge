/**
 * Clones BitCraftToolBox/BitCraft_Bindings (branch ts-region) into apps/forge/vendor.
 * Set FORGE_SKIP_BINDINGS_CLONE=1 to skip (e.g. CI unit tests that do not load bindings).
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const dest = join(repoRoot, "apps", "forge", "vendor", "BitCraft_Bindings");

if (process.env.FORGE_SKIP_BINDINGS_CLONE === "1") {
  process.stderr.write(
    "[forge] FORGE_SKIP_BINDINGS_CLONE=1 — skipping BitCraft bindings clone.\n"
  );
  process.exit(0);
}

if (existsSync(join(dest, "src", "index.ts"))) {
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
const url = "https://github.com/BitCraftToolBox/BitCraft_Bindings.git";
process.stderr.write(`[forge] Cloning BitCraft bindings (ts-region) into ${dest} …\n`);
execSync(`git clone --depth 1 --branch ts-region "${url}" "${dest}"`, {
  stdio: "inherit",
  cwd: repoRoot,
});
