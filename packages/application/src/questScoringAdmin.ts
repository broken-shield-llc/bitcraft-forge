import type {
  EntityCacheRepository,
  GuildConfigRepository,
  QuestScoringConfigView,
} from "@forge/repos";
import {
  formatQuestScoringModeForDisplay,
  type QuestLeaderboardScoringMode,
} from "@forge/domain";

export type QuestScoringAdminDeps = {
  repo: Pick<
    GuildConfigRepository,
    "getQuestScoringConfig" | "setQuestScoringConfig"
  >;
  entityCacheRepo: Pick<EntityCacheRepository, "getItemCraftingTiers">;
};

const WEIGHT_DISPLAY_ROWS: readonly { key: string; label: string }[] = [
  { key: "untiered", label: "untiered" },
  { key: "1", label: "tier_1" },
  { key: "2", label: "tier_2" },
  { key: "3", label: "tier_3" },
  { key: "4", label: "tier_4" },
  { key: "5", label: "tier_5" },
  { key: "6", label: "tier_6" },
  { key: "7", label: "tier_7" },
  { key: "8", label: "tier_8" },
  { key: "9", label: "tier_9" },
  { key: "10", label: "tier_10" },
] as const;

/** Tier ladder for weighted modes only (omitted when mode is Default). */
function formatWeightsSection(cfg: QuestScoringConfigView): string {
  const lines = WEIGHT_DISPLAY_ROWS.map(({ key, label }) => {
    const value = cfg.weights[key] ?? "—";
    return `• ${label}: **${value}**`;
  });
  return ["Weights:", ...lines].join("\n");
}

export async function executeQuestScoringShow(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestScoringAdminDeps
): Promise<{ content: string }> {
  const cfg = await deps.repo.getQuestScoringConfig(discordGuildId, forgeChannelId);
  if (!cfg) {
    return {
      content:
        "This channel is not forge-enabled, so there is no scoring configuration.",
    };
  }
  const parts = [
    "**Quest leaderboard scoring**",
    "",
    `Mode: **${formatQuestScoringModeForDisplay(cfg.mode)}**`,
  ];
  if (cfg.mode !== "default") {
    parts.push("", formatWeightsSection(cfg));
  }
  return { content: parts.join("\n") };
}

export type QuestScoringSetInput = {
  mode: QuestLeaderboardScoringMode;
  weightsPatch?: Partial<Record<string, number>> | null;
};

export async function executeQuestScoringSet(
  discordGuildId: string,
  forgeChannelId: string,
  input: QuestScoringSetInput,
  deps: QuestScoringAdminDeps
): Promise<{ content: string }> {
  const getTiers = (itemIds: number[]) =>
    deps.entityCacheRepo.getItemCraftingTiers(itemIds);
  const n = await deps.repo.setQuestScoringConfig(
    discordGuildId,
    forgeChannelId,
    {
      mode: input.mode,
      weightsPatch: input.weightsPatch,
    },
    getTiers
  );
  const cfg = await deps.repo.getQuestScoringConfig(discordGuildId, forgeChannelId);
  const tail =
    cfg == null
      ? ""
      : [
          "",
          "Current configuration:",
          `Mode: **${formatQuestScoringModeForDisplay(cfg.mode)}**`,
          ...(cfg.mode === "default" ? [] : ["", formatWeightsSection(cfg)]),
        ].join("\n");
  return {
    content: [
      "**Quest leaderboard scoring updated**",
      "",
      `Recalculated **${n}** completion row${n === 1 ? "" : "s"} for this channel scope.`,
      tail,
    ].join("\n"),
  };
}
