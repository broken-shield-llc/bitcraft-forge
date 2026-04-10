import type { EntityCacheTableCounts } from "@forge/repos";

export type ForgeStdbSnapshot = {
  connected: boolean;
  questProjectionReady: boolean;
};

export type ForgeHealthViewInput = {
  stdb: ForgeStdbSnapshot;
  entityCacheCounts: EntityCacheTableCounts;
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
  const { stdb, entityCacheCounts: c } = input;
  const lines = [
    "**FORGE**",
    "",
    ...forgeHealthStdbMarkdownLines(stdb),
    "",
    "Postgres STDB entity cache rows (mirrored from BitCraft subscriptions):",
    ...CACHE_LINES.map(
      ({ key, table }) => `${table}: **${c[key]}**`
    ),
  ];
  return lines.join("\n");
}
