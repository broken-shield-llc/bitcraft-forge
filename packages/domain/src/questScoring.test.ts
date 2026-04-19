import { describe, expect, it } from "vitest";
import {
  computeLeaderboardPoints,
  formatQuestScoringModeForDisplay,
  mergeQuestScoringWeights,
  parseQuestLeaderboardScoringMode,
  weightKeyForItemTier,
  weightForRequiredStackLine,
} from "./questScoring.js";
import type { ItemStackLike } from "./quest.js";

describe("mergeQuestScoringWeights", () => {
  it("fills defaults when stored is null", () => {
    const w = mergeQuestScoringWeights(null);
    expect(w.untiered).toBe(1);
    expect(w["1"]).toBe(1);
    expect(w["3"]).toBe(3);
  });

  it("overrides from stored object", () => {
    const w = mergeQuestScoringWeights({ untiered: 2, "5": 99, bad: "x" });
    expect(w.untiered).toBe(2);
    expect(w["5"]).toBe(99);
    expect(w["4"]).toBe(4);
  });
});

describe("formatQuestScoringModeForDisplay", () => {
  it("uses short labels for Discord copy", () => {
    expect(formatQuestScoringModeForDisplay("default")).toBe("default");
    expect(formatQuestScoringModeForDisplay("weighted_require_max")).toBe(
      "weighted max"
    );
    expect(formatQuestScoringModeForDisplay("weighted_require_sum")).toBe(
      "weighted sum"
    );
  });
});

describe("parseQuestLeaderboardScoringMode", () => {
  it("accepts known modes", () => {
    expect(parseQuestLeaderboardScoringMode("default")).toBe("default");
    expect(parseQuestLeaderboardScoringMode("weighted_require_max")).toBe(
      "weighted_require_max"
    );
    expect(parseQuestLeaderboardScoringMode("weighted_require_sum")).toBe(
      "weighted_require_sum"
    );
  });

  it("maps legacy per_completion to default", () => {
    expect(parseQuestLeaderboardScoringMode("per_completion")).toBe("default");
  });

  it("falls back for unknown", () => {
    expect(parseQuestLeaderboardScoringMode("nope")).toBe("default");
    expect(parseQuestLeaderboardScoringMode(undefined)).toBe("default");
  });
});

describe("weightKeyForItemTier", () => {
  it("maps tiers", () => {
    expect(weightKeyForItemTier(0)).toBe("untiered");
    expect(weightKeyForItemTier(1)).toBe("1");
    expect(weightKeyForItemTier(10)).toBe("10");
    expect(weightKeyForItemTier(11)).toBe("10");
    expect(weightKeyForItemTier(null)).toBe("untiered");
  });
});

describe("computeLeaderboardPoints", () => {
  const weights = mergeQuestScoringWeights({
    untiered: 1,
    "1": 1,
    "2": 2,
    "3": 3,
  });

  const req = (pairs: [number, number][]): ItemStackLike[] =>
    pairs.map(([itemId, quantity]) => ({ itemId, quantity }));

  it("default mode ignores stacks", () => {
    const m = new Map<number, number | null | undefined>([[1, 10]]);
    expect(
      computeLeaderboardPoints({
        mode: "default",
        requiredStacks: req([[1, 100]]),
        tierByItemId: m,
        weights,
      })
    ).toBe(1);
  });

  it("weighted_require_max picks highest line weight", () => {
    const m = new Map<number, number | null | undefined>([
      [1, 1],
      [2, 3],
    ]);
    expect(
      computeLeaderboardPoints({
        mode: "weighted_require_max",
        requiredStacks: req([
          [1, 1],
          [2, 1],
        ]),
        tierByItemId: m,
        weights,
      })
    ).toBe(3);
  });

  it("weighted_require_sum adds line weights", () => {
    const m = new Map<number, number | null | undefined>([
      [1, 1],
      [2, 3],
    ]);
    expect(
      computeLeaderboardPoints({
        mode: "weighted_require_sum",
        requiredStacks: req([
          [1, 1],
          [2, 1],
        ]),
        tierByItemId: m,
        weights,
      })
    ).toBe(4);
  });

  it("treats missing cache row as untiered weight", () => {
    const m = new Map<number, number | null | undefined>();
    expect(
      computeLeaderboardPoints({
        mode: "weighted_require_max",
        requiredStacks: req([[99, 1]]),
        tierByItemId: m,
        weights,
      })
    ).toBe(1);
  });

  it("empty required stacks uses untiered fallback in weighted modes", () => {
    expect(
      computeLeaderboardPoints({
        mode: "weighted_require_max",
        requiredStacks: [],
        tierByItemId: new Map(),
        weights: mergeQuestScoringWeights({ untiered: 7 }),
      })
    ).toBe(7);
  });
});

describe("weightForRequiredStackLine", () => {
  it("uses tier key when present", () => {
    const w = mergeQuestScoringWeights({ "2": 7 });
    const m = new Map([[1, 2]]);
    expect(weightForRequiredStackLine(1, m, w)).toBe(7);
  });
});
