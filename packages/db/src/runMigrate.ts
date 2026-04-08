import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import * as schema from "./schema.js";
import type { Logger } from "@forge/logger";

export async function runMigrations(pool: Pool, log: Logger): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = join(here, "../drizzle");
  const db = drizzle(pool, { schema });
  log.info("Running database migrations…");
  await migrate(db, { migrationsFolder });
  log.info("Database migrations applied");
}
