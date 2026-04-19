import type { GuildConfigRepository } from "@forge/repos";

export function forgeChannelNotEnabledMessage(commandName: string): string {
  return `This channel is not enabled for BitCraft Forge features. Run \`/${commandName} enable\` in this channel first.`;
}

export const FORGE_CHANNEL_NOT_ENABLED_MESSAGE =
  forgeChannelNotEnabledMessage("forge");

export type ForgeChannelEnableDeps = {
  repo: Pick<
    GuildConfigRepository,
    "enableForgeChannel" | "disableForgeChannel"
  >;
  /** Slash root (e.g. `forge`). Defaults to `forge`. */
  discordCommandName?: string;
};

export async function executeForgeEnable(
  discordGuildId: string,
  forgeChannelId: string,
  deps: ForgeChannelEnableDeps
): Promise<{ content: string }> {
  const cmd = deps.discordCommandName ?? "forge";
  const r = await deps.repo.enableForgeChannel(discordGuildId, forgeChannelId);
  if (r === "duplicate") {
    return {
      content: "This channel is already enabled for BitCraft Forge.",
    };
  }
  return {
    content: `BitCraft Forge is enabled for this channel. Configure monitors with \`/${cmd} claim\` and \`/${cmd} building\` here. Quest/barter embeds post here by default; use \`/${cmd} channel set\` to send them to any other text channel (or thread) instead. Use \`/${cmd} quest scoring\` to view or change how quest leaderboard points are calculated for this channel.`,
  };
}

export async function executeForgeDisable(
  discordGuildId: string,
  forgeChannelId: string,
  deps: ForgeChannelEnableDeps
): Promise<{ content: string }> {
  const cmd = deps.discordCommandName ?? "forge";
  const removed = await deps.repo.disableForgeChannel(
    discordGuildId,
    forgeChannelId
  );
  if (!removed) {
    return {
      content: `This channel is not forge-enabled (nothing to disable). Use \`/${cmd} enable\` first.`,
    };
  }
  return {
    content:
      "BitCraft Forge is disabled for this channel. Monitors and leaderboard data for this channel were removed.",
  };
}
