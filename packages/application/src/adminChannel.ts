import type { GuildConfigRepository } from "@forge/repos";

export type SetAnnouncementChannelDeps = {
  repo: Pick<GuildConfigRepository, "setAnnouncementChannel">;
};

/**
 * Persists announcement channel id (null = clear). Caller must validate channel type for non-null ids.
 */
export async function executeSetAnnouncementChannel(
  discordGuildId: string,
  channelId: string | null,
  deps: SetAnnouncementChannelDeps
): Promise<{ content: string }> {
  await deps.repo.setAnnouncementChannel(discordGuildId, channelId);
  if (channelId === null) {
    return {
      content:
        "Cleared the announcement channel. Set one with `/forge channel set announcements:#channel`.",
    };
  }
  return {
    content: `Quest / barter updates will post in <#${channelId}>.`,
  };
}
