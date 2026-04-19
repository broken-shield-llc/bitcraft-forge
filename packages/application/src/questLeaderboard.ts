import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";

export type QuestLeaderboardDeps = {
  repo: Pick<GuildConfigRepository, "questLeaderboard">;
  entityCacheRepo: Pick<
    EntityCacheRepository,
    "getTravelerUsernameForIdentity"
  >;
};

const TITLE = "**Quest Leaderboard**";

function formatLeaderboardReply(body: string): string {
  return `${TITLE}\n${body}`;
}

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

function leaderboardPlayerLine(
  subjectKey: string,
  nameBySubject: Map<string, string>
): string {
  const named = nameBySubject.get(subjectKey);
  if (named) return named;
  if (subjectKey.startsWith("d:")) {
    return `<@${subjectKey.slice(2)}>`;
  }
  if (subjectKey.startsWith("s:")) {
    return "Traveler";
  }
  return subjectKey;
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
      content: formatLeaderboardReply("The board was already empty."),
    };
  }
  return {
    content: formatLeaderboardReply(
      `The leaderboard has been reset. **${removed}** quest ${removed === 1 ? "completion" : "completions"} cleared.`
    ),
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
    return {
      content: formatLeaderboardReply("No quest completions yet."),
    };
  }
  const nameBySubject = await resolveStdbIdentityDisplayNames(
    deps.entityCacheRepo,
    rows.map((r) => r.subjectKey)
  );
  const lines = rows.map(
    (r, i) =>
      `${i + 1}. ${leaderboardPlayerLine(r.subjectKey, nameBySubject)} — **${r.points}** points`
  );
  return { content: formatLeaderboardReply(lines.join("\n")) };
}
