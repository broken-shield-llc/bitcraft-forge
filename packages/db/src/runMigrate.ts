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

/**
 * Idempotent repair for quest scoring / completion detail columns (0002).
 */
async function ensureQuestScoringColumns(pool: Pool, log: Logger): Promise<void> {
  const stmts = [
    `ALTER TABLE "forge_enabled_channels" ADD COLUMN IF NOT EXISTS "quest_leaderboard_scoring_mode" text NOT NULL DEFAULT 'default'`,
    `ALTER TABLE "forge_enabled_channels" ADD COLUMN IF NOT EXISTS "quest_scoring_weights" jsonb`,
    `ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "offer_stacks" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "require_stacks" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "leaderboard_points" integer NOT NULL DEFAULT 1`,
  ];
  for (const sql of stmts) {
    await pool.query(sql);
  }
  log.info(
    "Quest scoring column repair done (IF NOT EXISTS; safe if Drizzle already applied 0002)"
  );
}

/** Normalize legacy `per_completion` mode label and column default (see `0002_quest_scoring.sql`). */
async function ensureQuestScoringModeDefaultLabel(
  pool: Pool,
  log: Logger
): Promise<void> {
  await pool.query(
    `UPDATE "forge_enabled_channels" SET "quest_leaderboard_scoring_mode" = 'default' WHERE "quest_leaderboard_scoring_mode" = 'per_completion'`
  );
  await pool.query(
    `ALTER TABLE "forge_enabled_channels" ALTER COLUMN "quest_leaderboard_scoring_mode" SET DEFAULT 'default'`
  );
  log.info(
    "Quest scoring mode label repair done (per_completion → default; column default)"
  );
}

/** Denormalized display name on quest_completions (0003 / snapshot at completion time). */
async function ensureQuestSubjectDisplayNameColumn(
  pool: Pool,
  log: Logger
): Promise<void> {
  await pool.query(
    `ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "subject_display_name" text`
  );
  log.info(
    "Quest subject display name column repair done (IF NOT EXISTS; safe if 0003 already applied)"
  );
}

async function ensureQuestSubjectTravelerEntityIdColumn(
  pool: Pool,
  log: Logger
): Promise<void> {
  await pool.query(
    `ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "subject_traveler_entity_id" text`
  );
  log.info(
    "Quest subject traveler entity id column repair done (IF NOT EXISTS; safe if 0004 already applied)"
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
  await ensureQuestScoringColumns(pool, log);
  await ensureQuestScoringModeDefaultLabel(pool, log);
  await ensureQuestSubjectDisplayNameColumn(pool, log);
  await ensureQuestSubjectTravelerEntityIdColumn(pool, log);
  log.info("Database schema ready for Forge");
}
