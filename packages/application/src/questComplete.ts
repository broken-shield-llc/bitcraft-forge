import { normalizeScopedId, parseEntityIdString } from "@forge/domain";
import type { GuildConfigRepository } from "@forge/repos";

export type QuestCompleteDeps = {
  repo: Pick<GuildConfigRepository, "isBuildingMonitored" | "recordQuestCompletion">;
};

export type QuestCompleteInput = {
  discordGuildId: string;
  discordUserId: string;
  rawBuildingId: string;
  rawQuestEntityId: string;
};

/**
 * Records a manual quest completion for the leaderboard (`/forge quest complete`).
 */
export async function executeQuestComplete(
  input: QuestCompleteInput,
  deps: QuestCompleteDeps
): Promise<{ content: string }> {
  const buildingId = normalizeScopedId(input.rawBuildingId);
  const questEntityId = normalizeScopedId(input.rawQuestEntityId);
  if (!buildingId || !questEntityId) {
    return {
      content:
        "Invalid `building_id` or `quest_entity_id` (empty or too long).",
    };
  }
  if (
    parseEntityIdString(buildingId) === null ||
    parseEntityIdString(questEntityId) === null
  ) {
    return {
      content:
        "`building_id` and `quest_entity_id` must be numeric BitCraft entity ids.",
    };
  }
  const monitored = await deps.repo.isBuildingMonitored(
    input.discordGuildId,
    buildingId
  );
  if (!monitored) {
    return {
      content:
        "That `building_id` is not monitored for this server. Add it with `/forge building add` first.",
    };
  }
  const subjectKey = `d:${input.discordUserId}`;
  const r = await deps.repo.recordQuestCompletion(
    input.discordGuildId,
    buildingId,
    questEntityId,
    subjectKey
  );
  return {
    content:
      r === "duplicate"
        ? "You already logged this quest completion."
        : "Quest completion logged for the leaderboard (manual).",
  };
}
