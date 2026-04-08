import { loadDotenv, loadForgeConfig } from "@forge/config";
import { createLogger } from "@forge/logger";
import { startDiscordBot } from "./discordBot.js";
import { startStdb } from "./stdbClient.js";
import { createDb, createPool, runMigrations } from "@forge/db";
import { DrizzleGuildConfigRepository } from "@forge/repos";

loadDotenv();

const loaded = loadForgeConfig();
if (!loaded.ok) {
  console.error("[forge] Invalid configuration:");
  for (const e of loaded.errors) console.error(`  - ${e.key}: ${e.message}`);
  process.exit(1);
}

const log = createLogger(loaded.config.logLevel);

const pool = createPool(loaded.config.databaseUrl);
await runMigrations(pool, log);
const db = createDb(pool);
const repo = new DrizzleGuildConfigRepository(db);

startStdb(loaded.config, log);
await startDiscordBot(loaded.config, log, { repo });
