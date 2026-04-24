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
  /**
   * Group by case-folded identity hex, then set each *original* `s:…` string from
   * `quest_completions.subject_key` so `nameBySubject.get(r.subjectKey)` always hits.
   * (Rebuilding `s:` + trim(hex) from a Set can miss when casing or spacing differs
   * from the stored row, even if the name lookup by hex succeeds—e.g. same moment
   * as a completion message that used the same lookup.)
   */
  const byNorm = new Map<string, string[]>();
  for (const key of subjectKeys) {
    if (!key.startsWith("s:")) continue;
    const raw = key.slice(2).trim();
    if (!raw) continue;
    const n = raw.toLowerCase();
    const list = byNorm.get(n) ?? [];
    list.push(key);
    byNorm.set(n, list);
  }
  const out = new Map<string, string>();
  await Promise.all(
    [...byNorm.values()].map(async (keys) => {
      if (keys.length === 0) return;
      const lookupHex = keys[0]!.slice(2).trim();
      try {
        const name = await entityCacheRepo.getTravelerUsernameForIdentity(
          lookupHex
        );
        const t = name?.trim();
        if (!t) return;
        for (const k of keys) {
          out.set(k, t);
        }
      } catch {
        void 0;
      }
    })
  );
  return out;
}

function leaderboardPlayerLine(
  subjectKey: string,
  nameBySubject: Map<string, string>,
  storedDisplayName?: string | null
): string {
  if (subjectKey.startsWith("d:")) {
    return `<@${subjectKey.slice(2)}>`;
  }
  const fromRow = storedDisplayName?.trim();
  if (subjectKey.startsWith("s:") && fromRow) {
    return fromRow;
  }
  const named = nameBySubject.get(subjectKey);
  if (named) return named;
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

function resolveQuestLeaderboardRowLimit(
  options?: { limit?: number | null }
): number | null {
  if (options?.limit === null) return null;
  if (typeof options?.limit === "number") return options.limit;
  return null;
}

export async function executeQuestLeaderboard(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestLeaderboardDeps,
  options?: { limit?: number | null }
): Promise<{ content: string }> {
  const limit = resolveQuestLeaderboardRowLimit(options);
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
      `${i + 1}. ${leaderboardPlayerLine(
        r.subjectKey,
        nameBySubject,
        r.subjectDisplayName
      )} — **${r.points}** points`
  );
  return { content: formatLeaderboardReply(lines.join("\n")) };
}
