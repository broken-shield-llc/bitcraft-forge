import { formatCompletionSubjectDisplay } from "@forge/domain";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";

export type QuestLeaderboardDeps = {
  repo: Pick<GuildConfigRepository, "questLeaderboard">;
  entityCacheRepo: Pick<
    EntityCacheRepository,
    "getTravelerUsernameForIdentity"
  >;
};

const EMPTY_LEADERBOARD =
  "No quest completions logged yet. Completing a barter at a **monitored** building records a completion automatically.";

async function resolveStdbIdentityDisplayNames(
  entityCacheRepo: Pick<
    EntityCacheRepository,
    "getTravelerUsernameForIdentity"
  >,
  subjectKeys: string[]
): Promise<Map<string, string>> {
  const hexes = new Set<string>();
  for (const key of subjectKeys) {
    if (key.startsWith("s:")) {
      const hex = key.slice(2).trim();
      if (hex) hexes.add(hex);
    }
  }
  const out = new Map<string, string>();
  await Promise.all(
    [...hexes].map(async (hex) => {
      try {
        const name = await entityCacheRepo.getTravelerUsernameForIdentity(hex);
        const t = name?.trim();
        if (t) out.set(`s:${hex}`, t);
      } catch {
        void 0;
      }
    })
  );
  return out;
}

function leaderboardSubjectLine(
  subjectKey: string,
  stdbNameBySubject: Map<string, string>
): string {
  const named = stdbNameBySubject.get(subjectKey);
  if (named) return named;
  return formatCompletionSubjectDisplay(subjectKey);
}

export type QuestLeaderboardResetDeps = {
  repo: Pick<GuildConfigRepository, "clearQuestCompletionsForScope">;
};

export async function executeQuestLeaderboardReset(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestLeaderboardResetDeps
): Promise<{ content: string }> {
  const removed = await deps.repo.clearQuestCompletionsForScope(
    discordGuildId,
    forgeChannelId
  );
  if (removed === 0) {
    return {
      content:
        "**Quest leaderboard** reset: there were no logged completion rows for this channel.",
    };
  }
  return {
    content: `**Quest leaderboard** reset: removed **${removed}** logged completion row${removed === 1 ? "" : "s"} for this channel.`,
  };
}

export async function executeQuestLeaderboard(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestLeaderboardDeps,
  options?: { limit?: number }
): Promise<{ content: string }> {
  const limit = options?.limit ?? 10;
  const rows = await deps.repo.questLeaderboard(
    discordGuildId,
    forgeChannelId,
    limit
  );
  if (rows.length === 0) {
    return { content: EMPTY_LEADERBOARD };
  }
  const stdbNameBySubject = await resolveStdbIdentityDisplayNames(
    deps.entityCacheRepo,
    rows.map((r) => r.subjectKey)
  );
  const body = [
    "**Quest leaderboard** (logged completions; barter subjects show in-game names when cached)",
    ...rows.map(
      (r, i) =>
        `${i + 1}. ${leaderboardSubjectLine(r.subjectKey, stdbNameBySubject)} — **${r.completions}**`
    ),
  ].join("\n");
  return { content: body };
}
