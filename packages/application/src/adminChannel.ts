import type { GuildConfigRepository } from "@forge/repos";

export type SetAnnouncementChannelDeps = {
  repo: Pick<GuildConfigRepository, "setAnnouncementChannel">;
  /** Slash root (e.g. `forge`). Defaults to `forge`. */
  discordCommandName?: string;
};

export type QuestAnnouncementTargetKey =
  | "default"
  | "quest_added"
  | "quest_updated"
  | "quest_completion";

export type SetQuestAnnouncementTargetDeps = {
  repo: Pick<
    GuildConfigRepository,
    "setAnnouncementChannel" | "setQuestAnnouncementOverride"
  >;
  discordCommandName?: string;
};

/**
 * Persists announcement routing for a forge-enabled scope.
 * - **default**: fallback used when a per-kind override is unset; null pauses only that fallback (per-kind overrides still apply).
 * - **quest_***: override for that stream only; null clears the override.
 */
export async function executeSetQuestAnnouncementTarget(
  discordGuildId: string,
  forgeChannelId: string,
  target: QuestAnnouncementTargetKey,
  channelId: string | null,
  deps: SetQuestAnnouncementTargetDeps
): Promise<{ content: string }> {
  const cmd = deps.discordCommandName ?? "forge";
  if (target === "default") {
    await deps.repo.setAnnouncementChannel(
      discordGuildId,
      forgeChannelId,
      channelId
    );
    if (channelId === null) {
      return {
        content:
          `Cleared the **default** announcement target for this Forge scope. ` +
          `Per-stream overrides (**quest added** / **quest updated** / **quest completion**) are unchanged. ` +
          `Streams with no override and no default stay paused until you set \`/${cmd} channel set\` again.`,
      };
    }
    return {
      content:
        `Default quest/barter announcements for this scope will post in <#${channelId}> ` +
        `(used for any stream that does not have its own target).`,
    };
  }

  const overrideTarget =
    target === "quest_added"
      ? "quest_added"
      : target === "quest_updated"
        ? "quest_updated"
        : "quest_completion";
  await deps.repo.setQuestAnnouncementOverride(
    discordGuildId,
    forgeChannelId,
    overrideTarget,
    channelId
  );

  const label =
    target === "quest_added"
      ? "Quest **added**"
      : target === "quest_updated"
        ? "Quest **updated**"
        : "Quest **completion**";

  if (channelId === null) {
    return {
      content: `Cleared the ${label} announcement target for this scope (that stream falls back to the **default** target, if set).`,
    };
  }
  return {
    content: `${label} messages for this scope will post in <#${channelId}>.`,
  };
}

/** Same as {@link executeSetQuestAnnouncementTarget} with `target: "default"`. */
export async function executeSetAnnouncementChannel(
  discordGuildId: string,
  forgeChannelId: string,
  channelId: string | null,
  deps: SetAnnouncementChannelDeps
): Promise<{ content: string }> {
  return executeSetQuestAnnouncementTarget(
    discordGuildId,
    forgeChannelId,
    "default",
    channelId,
    {
      repo: deps.repo as SetQuestAnnouncementTargetDeps["repo"],
      discordCommandName: deps.discordCommandName,
    }
  );
}
