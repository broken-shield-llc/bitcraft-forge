import { formatCompletionSubjectDisplay } from "@forge/domain";
import type { GuildConfigRepository } from "@forge/repos";

export type QuestLeaderboardDeps = {
  repo: Pick<GuildConfigRepository, "questLeaderboard">;
};

const EMPTY_LEADERBOARD =
  "No quest completions logged yet. Completing a barter at a **monitored** building records a completion automatically; `/forge quest complete` is optional.";

/**
 * Builds the ephemeral `/forge quest leaderboard` message body.
 */
export async function executeQuestLeaderboard(
  discordGuildId: string,
  deps: QuestLeaderboardDeps,
  options?: { limit?: number }
): Promise<{ content: string }> {
  const limit = options?.limit ?? 10;
  const rows = await deps.repo.questLeaderboard(discordGuildId, limit);
  if (rows.length === 0) {
    return { content: EMPTY_LEADERBOARD };
  }
  const body = [
    "**Quest leaderboard** (logged completions; includes STDB identities from barter accepts)",
    ...rows.map(
      (r, i) =>
        `${i + 1}. ${formatCompletionSubjectDisplay(r.subjectKey)} — **${r.completions}**`
    ),
  ].join("\n");
  return { content: body };
}
