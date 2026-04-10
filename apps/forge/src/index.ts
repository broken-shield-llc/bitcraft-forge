import { loadDotenv, loadForgeConfig } from "@forge/config";
import { createLogger } from "@forge/logger";
import type { Client } from "discord.js";
import { QuestOfferCache, startStdb } from "./bitcraft/index.js";
import { startDiscordBot } from "./discordBot.js";
import { createDb, createPool, runMigrations } from "@forge/db";
import {
  DrizzleEntityCacheRepository,
  DrizzleGuildConfigRepository,
} from "@forge/repos";

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
const entityCacheRepo = new DrizzleEntityCacheRepository(db);

const questCache = new QuestOfferCache();
const discordHolder: { client?: Client } = {};

startStdb(loaded.config, log, {
  repo,
  entityCacheRepo,
  questCache,
  getDiscordClient: () => discordHolder.client,
});

discordHolder.client = await startDiscordBot(loaded.config, log, {
  repo,
  entityCacheRepo,
  questCache,
});
