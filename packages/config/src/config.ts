export type ForgeConfig = {
  discordToken: string;
  discordApplicationId: string;
  discordGuildId: string | undefined;
  bitcraftWsUri: string;
  bitcraftModule: string;
  bitcraftJwt: string;
  databaseUrl: string;
  pocEventLogPath: string | undefined;
  logLevel: "debug" | "info" | "warn" | "error";
  /** Coalesce rapid quest/offer updates before posting to Discord (ms). */
  announcementDebounceMs: number;
  /**
   * When false, skip Discord announcements for `trade_order_state` **updates** (owner edits / stock changes).
   * **New** listings still announce. Quest **completion** announcements still post when a barter accept commits.
   */
  questAnnouncementTradeUpdates: boolean;
  /**
   * After a committed barter accept, suppress matching **update** announcements for this long (per scope + quest key).
   * Should exceed {@link ForgeConfig.announcementDebounceMs} so debounced updates are dropped.
   */
  questCompletionSuppressUpdatesMs: number;
  /** After STDB subscriptions apply, skip Discord quest announces for this long (absorbs replay). */
  questAnnounceGraceMs: number;
  /** Total offered quantity at/above this value is treated as high rarity. */
  questRarityHighThreshold: number;
  /** Min age (ms) before Postgres-cached STDB entity rows may be overwritten. */
  stdbCacheTtlMs: number;
  /**
   * Optional image URL for `/forge quest board` (HTTPS). Shown as a wide banner above the text.
   */
  questBoardBannerUrl: string | undefined;
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
  const databaseUrl = req(
    "FORGE_DATABASE_URL",
    "Postgres connection URL (FORGE_DATABASE_URL)"
  );

  const guildRaw = f.FORGE_DISCORD_GUILD_ID?.trim();
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

  const poc = f.FORGE_POC_EVENT_LOG?.trim();

  const debounceRaw = f.FORGE_ANNOUNCEMENT_DEBOUNCE_MS?.trim();
  let announcementDebounceMs = 4000;
  if (debounceRaw !== undefined && debounceRaw !== "") {
    const n = Number(debounceRaw);
    if (!Number.isFinite(n) || n < 0 || n > 600_000) {
      errors.push({
        key: "FORGE_ANNOUNCEMENT_DEBOUNCE_MS",
        message:
          "FORGE_ANNOUNCEMENT_DEBOUNCE_MS must be a number between 0 and 600000",
      });
    } else {
      announcementDebounceMs = Math.floor(n);
    }
  }

  const tradeUpdatesRaw = (
    f.FORGE_QUEST_ANNOUNCE_TRADE_UPDATES ?? ""
  ).trim().toLowerCase();
  let questAnnouncementTradeUpdates = true;
  if (
    tradeUpdatesRaw === "0" ||
    tradeUpdatesRaw === "false" ||
    tradeUpdatesRaw === "no"
  ) {
    questAnnouncementTradeUpdates = false;
  } else if (
    tradeUpdatesRaw !== "" &&
    tradeUpdatesRaw !== "1" &&
    tradeUpdatesRaw !== "true" &&
    tradeUpdatesRaw !== "yes"
  ) {
    errors.push({
      key: "FORGE_QUEST_ANNOUNCE_TRADE_UPDATES",
      message:
        "FORGE_QUEST_ANNOUNCE_TRADE_UPDATES must be 0/false/no or 1/true/yes (empty = true)",
    });
  }

  let questCompletionSuppressUpdatesMs = announcementDebounceMs + 3000;
  const suppressRaw = f.FORGE_QUEST_COMPLETION_SUPPRESS_UPDATE_MS?.trim();
  if (suppressRaw !== undefined && suppressRaw !== "") {
    const n = Number(suppressRaw);
    if (!Number.isFinite(n) || n < 2000 || n > 120_000) {
      errors.push({
        key: "FORGE_QUEST_COMPLETION_SUPPRESS_UPDATE_MS",
        message:
          "FORGE_QUEST_COMPLETION_SUPPRESS_UPDATE_MS must be between 2000 and 120000",
      });
    } else {
      questCompletionSuppressUpdatesMs = Math.floor(n);
    }
  }

  const graceRaw = f.FORGE_QUEST_ANNOUNCE_GRACE_MS?.trim();
  let questAnnounceGraceMs = 4000;
  if (graceRaw !== undefined && graceRaw !== "") {
    const n = Number(graceRaw);
    if (!Number.isFinite(n) || n < 0 || n > 120_000) {
      errors.push({
        key: "FORGE_QUEST_ANNOUNCE_GRACE_MS",
        message:
          "FORGE_QUEST_ANNOUNCE_GRACE_MS must be a number between 0 and 120000",
      });
    } else {
      questAnnounceGraceMs = Math.floor(n);
    }
  }

  const rarityRaw = f.FORGE_QUEST_RARITY_HIGH_THRESHOLD?.trim();
  let questRarityHighThreshold = 100;
  if (rarityRaw !== undefined && rarityRaw !== "") {
    const n = Number(rarityRaw);
    if (!Number.isFinite(n) || n < 1 || n > 1_000_000_000) {
      errors.push({
        key: "FORGE_QUEST_RARITY_HIGH_THRESHOLD",
        message:
          "FORGE_QUEST_RARITY_HIGH_THRESHOLD must be a number between 1 and 1000000000",
      });
    } else {
      questRarityHighThreshold = Math.floor(n);
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

  if (errors.length) return { ok: false, errors };

  const questBoardBannerUrl =
    f.FORGE_QUEST_BOARD_BANNER_URL?.trim() || undefined;

  return {
    ok: true,
    config: {
      discordToken: discordToken!,
      discordApplicationId: discordApplicationId!,
      discordGuildId: guildRaw || undefined,
      bitcraftWsUri: bitcraftWsUri!,
      bitcraftModule: bitcraftModule!,
      bitcraftJwt: bitcraftJwt!,
      databaseUrl: databaseUrl!,
      pocEventLogPath: poc || undefined,
      logLevel,
      announcementDebounceMs,
      questAnnouncementTradeUpdates,
      questCompletionSuppressUpdatesMs,
      questAnnounceGraceMs,
      questRarityHighThreshold,
      stdbCacheTtlMs,
      questBoardBannerUrl,
    },
  };
}
