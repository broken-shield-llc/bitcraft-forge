import type { ItemStackLike } from "./quest.js";

export type QuestLeaderboardScoringMode =
  | "default"
  | "weighted_require_max"
  | "weighted_require_sum";

export const QUEST_LEADERBOARD_SCORING_MODES: readonly QuestLeaderboardScoringMode[] =
  ["default", "weighted_require_max", "weighted_require_sum"] as const;

export function formatQuestScoringModeForDisplay(
  mode: QuestLeaderboardScoringMode
): string {
  switch (mode) {
    case "default":
      return "default";
    case "weighted_require_max":
      return "weighted max";
    case "weighted_require_sum":
      return "weighted sum";
  }
}

/**
 * Baseline tier weights when none are stored: **1** for untiered and tier 1, **N** for tier N (2–10).
 * Weighted modes use these until an admin overrides them via `/forge quest scoring set`.
 */
export const DEFAULT_QUEST_SCORING_WEIGHTS: Record<string, number> = {
  untiered: 1,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
};

export function mergeQuestScoringWeights(
  stored: Record<string, unknown> | null | undefined
): Record<string, number> {
  const out = { ...DEFAULT_QUEST_SCORING_WEIGHTS };
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        out[k] = v;
      }
    }
  }
  return out;
}

export function parseQuestLeaderboardScoringMode(
  raw: string | null | undefined
): QuestLeaderboardScoringMode {
  if (raw === "per_completion") return "default";
  if (
    raw === "weighted_require_max" ||
    raw === "weighted_require_sum" ||
    raw === "default"
  ) {
    return raw;
  }
  return "default";
}

/**
 * Maps `ItemDesc.tier` from SpacetimeDB (0 = no tier / non-progression items).
 */
export function weightKeyForItemTier(tier: number | null | undefined): string {
  if (tier == null || !Number.isFinite(tier)) return "untiered";
  const t = Math.trunc(tier);
  if (t <= 0) return "untiered";
  if (t > 10) return "10";
  return String(t);
}

export function weightForRequiredStackLine(
  itemId: number,
  tierByItemId: Map<number, number | null | undefined>,
  weights: Record<string, number>
): number {
  const untieredW = weights.untiered ?? DEFAULT_QUEST_SCORING_WEIGHTS.untiered;
  if (!tierByItemId.has(itemId)) {
    return typeof untieredW === "number" && Number.isFinite(untieredW)
      ? untieredW
      : DEFAULT_QUEST_SCORING_WEIGHTS.untiered;
  }
  const key = weightKeyForItemTier(tierByItemId.get(itemId) ?? null);
  const w = weights[key];
  if (typeof w === "number" && Number.isFinite(w)) return w;
  return untieredW;
}

export function computeLeaderboardPoints(input: {
  mode: QuestLeaderboardScoringMode;
  requiredStacks: ItemStackLike[];
  tierByItemId: Map<number, number | null | undefined>;
  weights: Record<string, number>;
}): number {
  const { mode, requiredStacks, tierByItemId, weights } = input;
  if (mode === "default") return 1;

  const lineWeights = requiredStacks.map((s) =>
    weightForRequiredStackLine(s.itemId, tierByItemId, weights)
  );
  const fallback =
    weights.untiered ?? DEFAULT_QUEST_SCORING_WEIGHTS.untiered;
  if (lineWeights.length === 0) return fallback;

  if (mode === "weighted_require_max") return Math.max(...lineWeights);
  return lineWeights.reduce((a, b) => a + b, 0);
}
