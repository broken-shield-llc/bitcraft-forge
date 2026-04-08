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

  if (errors.length) return { ok: false, errors };

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
    },
  };
}
