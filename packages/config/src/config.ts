export type ForgeConfig = {
  discordToken: string;
  discordApplicationId: string;
  /**
   * Root slash command name (e.g. `forge`, `forgedev`). Must be 1–32 chars: lowercase letters, digits, underscore, hyphen.
   */
  discordCommandName: string;
  discordGuildId: string | undefined;
  bitcraftWsUri: string;
  bitcraftModule: string;
  bitcraftJwt: string;
  databaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
  /** Coalesce quest/barter Discord embed posts per logical key (`FORGE_QUEST_DISCORD_DEBOUNCE_MS`). */
  questDiscordDebounceMs: number;
  /**
   * After a barter completion, suppress matching **update** embeds for this long (per scope + quest key).
   * Should exceed {@link ForgeConfig.questDiscordDebounceMs} so debounced updates are dropped.
   */
  questSuppressUpdateAfterCompleteMs: number;
  /** No quest Discord embeds until this long after STDB quest subscriptions finish initial sync (`FORGE_QUEST_ANNOUNCE_AFTER_STDB_SYNC_MS`). */
  questAnnounceAfterStdbSyncMs: number;
  stdbCacheTtlMs: number;
  questBoardBannerUrl: string | undefined;
  /**
   * When set, binds an HTTP server on this port for `GET /health` (liveness).
   * Omit or leave unset to disable (`FORGE_HEALTH_PORT`).
   */
  healthListenPort: number | undefined;
};

export type ConfigError = { key: string; message: string };

function forgeEnvKeys(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    if (key.startsWith("FORGE_")) out[key] = env[key];
  }
  return out;
}

export function loadForgeConfig(
  env: NodeJS.ProcessEnv = process.env
): { ok: true; config: ForgeConfig } | { ok: false; errors: ConfigError[] } {
  const f = forgeEnvKeys(env);
  const errors: ConfigError[] = [];

  const req = (key: string, label: string) => {
    const v = f[key] ?? env[key];
    const t = typeof v === "string" ? v.trim() : "";
    if (!t) errors.push({ key, message: `${label} (${key}) is required` });
    return t || undefined;
  };

  const discordToken = req("FORGE_DISCORD_TOKEN", "Discord bot token");
  const discordApplicationId = req(
    "FORGE_DISCORD_APPLICATION_ID",
    "Discord application ID"
  );
  const bitcraftWsUri = req(
    "FORGE_BITCRAFT_WS_URI",
    "BitCraft SpacetimeDB WebSocket URI"
  );
  const bitcraftModule = req("FORGE_BITCRAFT_MODULE", "BitCraft module name");
  const bitcraftJwt = req("FORGE_BITCRAFT_JWT", "BitCraft JWT");

  const databaseUrlDirect = (f.FORGE_DATABASE_URL ?? env.FORGE_DATABASE_URL)?.trim();
  const dbHost = (f.FORGE_DATABASE_HOST ?? env.FORGE_DATABASE_HOST)?.trim();
  const dbUser = (f.FORGE_DATABASE_USER ?? env.FORGE_DATABASE_USER)?.trim();
  const dbPassword = (f.FORGE_DATABASE_PASSWORD ?? env.FORGE_DATABASE_PASSWORD)?.trim();
  const dbName = (f.FORGE_DATABASE_NAME ?? env.FORGE_DATABASE_NAME)?.trim();
  const dbPortRaw = (f.FORGE_DATABASE_PORT ?? env.FORGE_DATABASE_PORT)?.trim();
  const dbSslMode = (f.FORGE_DATABASE_SSLMODE ?? env.FORGE_DATABASE_SSLMODE)?.trim();

  let databaseUrl: string | undefined;
  if (databaseUrlDirect) {
    databaseUrl = databaseUrlDirect;
  } else if (dbHost && dbUser && dbPassword && dbName) {
    const port =
      dbPortRaw && dbPortRaw !== ""
        ? Number(dbPortRaw)
        : 5432;
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      errors.push({
        key: "FORGE_DATABASE_PORT",
        message:
          "FORGE_DATABASE_PORT must be a number between 1 and 65535 when using composite DB settings",
      });
    } else {
      const encUser = encodeURIComponent(dbUser);
      const encPass = encodeURIComponent(dbPassword);
      const encName = encodeURIComponent(dbName);
      const q =
        dbSslMode && dbSslMode !== ""
          ? `?sslmode=${encodeURIComponent(dbSslMode)}`
          : "";
      databaseUrl = `postgresql://${encUser}:${encPass}@${dbHost}:${Math.floor(port)}/${encName}${q}`;
    }
  } else if (dbHost || dbUser || dbPassword || dbName) {
    errors.push({
      key: "FORGE_DATABASE_URL",
      message:
        "Composite DB settings require all of: FORGE_DATABASE_HOST, FORGE_DATABASE_USER, FORGE_DATABASE_PASSWORD, FORGE_DATABASE_NAME (optional FORGE_DATABASE_PORT, FORGE_DATABASE_SSLMODE)",
    });
  } else {
    errors.push({
      key: "FORGE_DATABASE_URL",
      message:
        "Set FORGE_DATABASE_URL, or FORGE_DATABASE_HOST + FORGE_DATABASE_USER + FORGE_DATABASE_PASSWORD + FORGE_DATABASE_NAME (optional FORGE_DATABASE_PORT, FORGE_DATABASE_SSLMODE)",
    });
  }

  const guildRaw = f.FORGE_DISCORD_GUILD_ID?.trim();

  const commandNameRaw = (f.FORGE_DISCORD_COMMAND_NAME ?? "forge").trim();
  if (!/^[-a-z0-9_]{1,32}$/.test(commandNameRaw)) {
    errors.push({
      key: "FORGE_DISCORD_COMMAND_NAME",
      message:
        "FORGE_DISCORD_COMMAND_NAME must be 1–32 characters: lowercase letters, digits, underscore, or hyphen (default: forge)",
    });
  }

  const logRaw = (f.FORGE_LOG_LEVEL ?? "info").toLowerCase();
  let logLevel: ForgeConfig["logLevel"] = "info";
  if (
    logRaw === "debug" ||
    logRaw === "info" ||
    logRaw === "warn" ||
    logRaw === "error"
  ) {
    logLevel = logRaw;
  } else {
    errors.push({
      key: "FORGE_LOG_LEVEL",
      message: "FORGE_LOG_LEVEL must be debug, info, warn, or error",
    });
  }

  const debounceRaw = f.FORGE_QUEST_DISCORD_DEBOUNCE_MS?.trim();
  let questDiscordDebounceMs = 4000;
  if (debounceRaw !== undefined && debounceRaw !== "") {
    const n = Number(debounceRaw);
    if (!Number.isFinite(n) || n < 0 || n > 600_000) {
      errors.push({
        key: "FORGE_QUEST_DISCORD_DEBOUNCE_MS",
        message:
          "FORGE_QUEST_DISCORD_DEBOUNCE_MS must be a number between 0 and 600000",
      });
    } else {
      questDiscordDebounceMs = Math.floor(n);
    }
  }

  let questSuppressUpdateAfterCompleteMs = questDiscordDebounceMs + 3000;
  const suppressRaw =
    f.FORGE_QUEST_SUPPRESS_UPDATE_AFTER_COMPLETE_MS?.trim();
  if (suppressRaw !== undefined && suppressRaw !== "") {
    const n = Number(suppressRaw);
    if (!Number.isFinite(n) || n < 2000 || n > 120_000) {
      errors.push({
        key: "FORGE_QUEST_SUPPRESS_UPDATE_AFTER_COMPLETE_MS",
        message:
          "FORGE_QUEST_SUPPRESS_UPDATE_AFTER_COMPLETE_MS must be between 2000 and 120000",
      });
    } else {
      questSuppressUpdateAfterCompleteMs = Math.floor(n);
    }
  }

  const syncQuietRaw = f.FORGE_QUEST_ANNOUNCE_AFTER_STDB_SYNC_MS?.trim();
  let questAnnounceAfterStdbSyncMs = 4000;
  if (syncQuietRaw !== undefined && syncQuietRaw !== "") {
    const n = Number(syncQuietRaw);
    if (!Number.isFinite(n) || n < 0 || n > 120_000) {
      errors.push({
        key: "FORGE_QUEST_ANNOUNCE_AFTER_STDB_SYNC_MS",
        message:
          "FORGE_QUEST_ANNOUNCE_AFTER_STDB_SYNC_MS must be a number between 0 and 120000",
      });
    } else {
      questAnnounceAfterStdbSyncMs = Math.floor(n);
    }
  }

  const ttlRaw = f.FORGE_STDB_CACHE_TTL_MS?.trim();
  let stdbCacheTtlMs = 86_400_000;
  if (ttlRaw !== undefined && ttlRaw !== "") {
    const n = Number(ttlRaw);
    if (!Number.isFinite(n) || n < 0 || n > 365 * 86_400_000) {
      errors.push({
        key: "FORGE_STDB_CACHE_TTL_MS",
        message:
          "FORGE_STDB_CACHE_TTL_MS must be between 0 and 31536000000 (365 days in ms)",
      });
    } else {
      stdbCacheTtlMs = Math.floor(n);
    }
  }

  const healthRaw = f.FORGE_HEALTH_PORT?.trim();
  let healthListenPort: number | undefined;
  if (healthRaw !== undefined && healthRaw !== "") {
    const n = Number(healthRaw);
    if (!Number.isFinite(n) || n < 1 || n > 65535) {
      errors.push({
        key: "FORGE_HEALTH_PORT",
        message:
          "FORGE_HEALTH_PORT must be a number between 1 and 65535, or unset to disable the health HTTP server",
      });
    } else {
      healthListenPort = Math.floor(n);
    }
  }

  if (errors.length) return { ok: false, errors };

  const questBoardBannerUrl =
    f.FORGE_QUEST_BOARD_BANNER_URL?.trim() || undefined;

  return {
    ok: true,
    config: {
      discordToken: discordToken!,
      discordApplicationId: discordApplicationId!,
      discordCommandName: commandNameRaw,
      discordGuildId: guildRaw || undefined,
      bitcraftWsUri: bitcraftWsUri!,
      bitcraftModule: bitcraftModule!,
      bitcraftJwt: bitcraftJwt!,
      databaseUrl: databaseUrl!,
      logLevel,
      questDiscordDebounceMs,
      questSuppressUpdateAfterCompleteMs,
      questAnnounceAfterStdbSyncMs,
      stdbCacheTtlMs,
      questBoardBannerUrl,
      healthListenPort,
    },
  };
}
