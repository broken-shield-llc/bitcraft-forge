import type { GuildConfigRepository } from "@forge/repos";

export const FORGE_CHANNEL_NOT_ENABLED_MESSAGE =
  "This channel is not enabled for BitCraft Forge features. Run `/forge enable` in this channel first.";

export type ForgeChannelEnableDeps = {
  repo: Pick<
    GuildConfigRepository,
    "enableForgeChannel" | "disableForgeChannel"
  >;
};

export async function executeForgeEnable(
  discordGuildId: string,
  forgeChannelId: string,
  deps: ForgeChannelEnableDeps
): Promise<{ content: string }> {
  const r = await deps.repo.enableForgeChannel(discordGuildId, forgeChannelId);
  if (r === "duplicate") {
    return {
      content: "This channel is already enabled for BitCraft Forge.",
    };
  }
  return {
    content:
      "BitCraft Forge is enabled for this channel. Configure monitors with `/forge claim` and `/forge building` here. Quest / barter announcements post here by default; use `/forge channel set` to target another channel.",
  };
}

export async function executeForgeDisable(
  discordGuildId: string,
  forgeChannelId: string,
  deps: ForgeChannelEnableDeps
): Promise<{ content: string }> {
  const removed = await deps.repo.disableForgeChannel(
    discordGuildId,
    forgeChannelId
  );
  if (!removed) {
    return {
      content:
        "This channel is not forge-enabled (nothing to disable). Use `/forge enable` first.",
    };
  }
  return {
    content:
      "BitCraft Forge is disabled for this channel. Monitors and leaderboard data for this channel were removed.",
  };
}
