import type { GuildConfigRepository } from "@forge/repos";

export type SetAnnouncementChannelDeps = {
  repo: Pick<GuildConfigRepository, "setAnnouncementChannel">;
  /** Slash root (e.g. `forge`). Defaults to `forge`. */
  discordCommandName?: string;
};

/**
 * Persists announcement channel for a forge-enabled scope (null = stop posting until set again).
 * Caller must validate channel type for non-null ids.
 */
export async function executeSetAnnouncementChannel(
  discordGuildId: string,
  forgeChannelId: string,
  channelId: string | null,
  deps: SetAnnouncementChannelDeps
): Promise<{ content: string }> {
  const cmd = deps.discordCommandName ?? "forge";
  await deps.repo.setAnnouncementChannel(
    discordGuildId,
    forgeChannelId,
    channelId
  );
  if (channelId === null) {
    return {
      content: `Cleared the announcements target for this channel’s Forge scope. Quest / barter embeds are paused until you set one with \`/${cmd} channel set announcements:#channel\` here again.`,
    };
  }
  return {
    content: `Quest / barter updates for this Forge channel will post in <#${channelId}>.`,
  };
}
