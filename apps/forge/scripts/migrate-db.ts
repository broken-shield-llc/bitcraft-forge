/**
 * Run Drizzle migrations only (same as forge startup). Use when the DB is behind the code
 * (e.g. after `git pull`) without starting the Discord bot.
 *
 *   pnpm --filter forge migrate-db
 */
import { loadDotenv, loadForgeConfig } from "@forge/config";
import { createPool, runMigrations } from "@forge/db";
import { createLogger } from "@forge/logger";

loadDotenv();
const loaded = loadForgeConfig();
if (!loaded.ok) {
  console.error("[migrate-db] Invalid configuration:");
  for (const e of loaded.errors) console.error(`  - ${e.key}: ${e.message}`);
  process.exit(1);
}

const log = createLogger(loaded.config.logLevel);
const pool = createPool(loaded.config.databaseUrl);
try {
  await runMigrations(pool, log, {
    databaseUrlHint: loaded.config.databaseUrl,
  });
} finally {
  await pool.end();
}

console.error(
  "[migrate-db] If the target above is not the DB you use in pgAdmin, unset shell overrides " +
    "(e.g. `unset FORGE_DATABASE_URL`) so `.env` wins, or align `FORGE_DATABASE_URL`."
);
