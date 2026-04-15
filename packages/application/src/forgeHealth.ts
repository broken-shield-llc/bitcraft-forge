import type { EntityCacheTableCounts } from "@forge/repos";

export type ForgeStdbSnapshot = {
  connected: boolean;
  questProjectionReady: boolean;
};

export type ForgeHealthDiscordMeta = {
  commandName: string;
  /** When set, slash commands were registered for this guild only at bot startup. */
  slashGuildRegistrationId?: string;
};

export type ForgeHealthViewInput = {
  stdb: ForgeStdbSnapshot;
  entityCacheCounts: EntityCacheTableCounts;
  /** Operator-only hints (e.g. from `/forge health`). */
  discordMeta?: ForgeHealthDiscordMeta;
  /** When set, skips cache table listing (e.g. DB error). */
  cacheCountsErrorMessage?: string;
};

export function forgeHealthStdbMarkdownLines(stdb: ForgeStdbSnapshot): string[] {
  return [
    `SpacetimeDB connected: **${stdb.connected}**`,
    `Quest projection ready: **${stdb.questProjectionReady}**`,
  ];
}

const CACHE_LINES: { key: keyof EntityCacheTableCounts; table: string }[] = [
  { key: "itemDesc", table: "`item_desc`" },
  { key: "claimState", table: "`claim_state`" },
  { key: "buildingState", table: "`building_state`" },
  { key: "buildingDesc", table: "`building_desc`" },
  { key: "buildingNickname", table: "`building_nickname_state`" },
  { key: "inventoryState", table: "`inventory_state`" },
  { key: "userState", table: "`user_state`" },
  { key: "playerUsername", table: "`player_username_state`" },
];

export function buildForgeHealthContent(input: ForgeHealthViewInput): string {
  const {
    stdb,
    entityCacheCounts: c,
    discordMeta,
    cacheCountsErrorMessage,
  } = input;
  const lines = [
    "**FORGE**",
    "",
    ...forgeHealthStdbMarkdownLines(stdb),
    "",
  ];
  if (cacheCountsErrorMessage) {
    lines.push(cacheCountsErrorMessage);
  } else {
    lines.push(
      "Postgres STDB entity cache rows (mirrored from BitCraft subscriptions):",
      ...CACHE_LINES.map(({ key, table }) => `${table}: **${c[key]}**`)
    );
  }
  if (discordMeta) {
    const cmd = discordMeta.commandName;
    const gid = discordMeta.slashGuildRegistrationId;
    lines.push(
      "",
      `Discord: root **/${cmd}**; slash commands registered **${
        gid ? `for guild \`${gid}\` only` : "globally"
      }**.`
    );
    if (gid) {
      lines.push(
        "Other servers never list this command tree until `FORGE_DISCORD_GUILD_ID` is unset and the bot re-registers globally."
      );
    }
  }
  return lines.join("\n");
}
