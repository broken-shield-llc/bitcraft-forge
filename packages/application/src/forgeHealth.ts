/** Snapshot from `getStdbHealth()` — duplicated here so application does not depend on the forge STDB adapter package. */
export type ForgeHealthSnapshot = {
  connected: boolean;
  identityHex: string | null;
  subscriptionApplied: boolean;
  tradeOrderRowCount: number;
  travelerTradeDescRowCount: number;
  lastError: string | null;
};

export type ForgeHealthViewInput = {
  bitcraftWsUri: string;
  bitcraftModule: string;
  bitcraftJwtSet: boolean;
  nodeVersion: string;
  health: ForgeHealthSnapshot;
};

/** Ephemeral `/forge health` body (Markdown). */
export function buildForgeHealthContent(input: ForgeHealthViewInput): string {
  const h = input.health;
  const lines = [
    "**FORGE**",
    `WS: \`${input.bitcraftWsUri}\``,
    `Module: \`${input.bitcraftModule}\``,
    `BitCraft JWT: **${input.bitcraftJwtSet ? "set" : "missing"}**`,
    `Node \`${input.nodeVersion}\``,
    `SpacetimeDB connected: **${h.connected}**`,
    `SpacetimeDB identity: \`${h.identityHex ?? "—"}\``,
    `Quest projection ready: **${h.subscriptionApplied}**`,
    `\`trade_order_state\` rows: **${h.tradeOrderRowCount}**`,
    `\`traveler_trade_order_desc\` rows: **${h.travelerTradeDescRowCount}**`,
  ];
  if (h.lastError) lines.push(`Last STDB error: \`${h.lastError}\``);
  if (!input.bitcraftJwtSet) {
    lines.push(
      "",
      "Set **FORGE_BITCRAFT_JWT** in `.env` (BitCraft session token); restart Forge. Without it, SpacetimeDB usually will not connect."
    );
  } else if (!h.connected) {
    lines.push(
      "",
      "Check logs for `SpacetimeDB onConnectError`, verify **FORGE_BITCRAFT_WS_URI** / **FORGE_BITCRAFT_MODULE**, network, and that the token is still valid."
    );
  }
  return lines.join("\n");
}
