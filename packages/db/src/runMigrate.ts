import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import * as schema from "./schema.js";
import type { Logger } from "@forge/logger";
import { isPgDuplicateRelation } from "./pgErrors.js";

/** Host + database name for logs (no credentials). */
export function summarizeDatabaseUrl(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    const db = u.pathname.replace(/^\//, "") || "(no db)";
    return `${u.hostname}/${db}`;
  } catch {
    return "(could not parse URL)";
  }
}

/**
 * Idempotent repair: Drizzle may skip `0001` if `drizzle.__drizzle_migrations` is out of sync
 * with `public` (e.g. restored DB, wrong DB migrated, journal-only state). These columns are
 * required by the app when using per-stream quest targets.
 */
async function ensureForgeQuestAnnouncementColumns(
  pool: Pool,
  log: Logger
): Promise<void> {
  const stmts = [
    `ALTER TABLE "forge_enabled_channels" ADD COLUMN IF NOT EXISTS "quest_added_channel_id" text`,
    `ALTER TABLE "forge_enabled_channels" ADD COLUMN IF NOT EXISTS "quest_updated_channel_id" text`,
    `ALTER TABLE "forge_enabled_channels" ADD COLUMN IF NOT EXISTS "quest_completion_channel_id" text`,
  ];
  for (const sql of stmts) {
    await pool.query(sql);
  }
  log.info(
    "Quest announcement column repair done (IF NOT EXISTS; safe if Drizzle already applied 0001)"
  );
}

export type RunMigrationsOptions = {
  /** Logged as `host/dbname` so you can confirm migrate matches the DB you inspect. */
  databaseUrlHint?: string;
};

export async function runMigrations(
  pool: Pool,
  log: Logger,
  options?: RunMigrationsOptions
): Promise<void> {
  if (options?.databaseUrlHint) {
    log.info(
      "Database connection target (migrate)",
      summarizeDatabaseUrl(options.databaseUrlHint)
    );
  }
  /** Next to `packages/db/src/` — must contain `drizzle/meta/_journal.json` and `*.sql`. */
  const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
  const db = drizzle(pool, { schema });
  log.info("Running Drizzle journal migrations…", `folder=${migrationsFolder}`);
  try {
    await migrate(db, { migrationsFolder });
  } catch (e) {
    if (isPgDuplicateRelation(e)) {
      log.warn("Migration relation already exists; continuing startup");
    } else {
      throw e;
    }
  }
  log.info("Drizzle journal migrations finished");
  await ensureForgeQuestAnnouncementColumns(pool, log);
  log.info("Database schema ready for Forge");
}
