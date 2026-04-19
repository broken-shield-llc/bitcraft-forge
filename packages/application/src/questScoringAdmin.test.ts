import { describe, expect, it, vi } from "vitest";
import { mergeQuestScoringWeights } from "@forge/domain";
import {
  executeQuestScoringSet,
  executeQuestScoringShow,
} from "./questScoringAdmin.js";

describe("executeQuestScoringShow", () => {
  it("returns not-enabled copy when config is missing", async () => {
    const deps = {
      repo: {
        getQuestScoringConfig: vi.fn().mockResolvedValue(null),
      },
    };
    const { content } = await executeQuestScoringShow("g1", "c1", deps);
    expect(content).toContain("not forge-enabled");
    expect(deps.repo.getQuestScoringConfig).toHaveBeenCalledWith("g1", "c1");
  });

  it("omits weights for default mode", async () => {
    const deps = {
      repo: {
        getQuestScoringConfig: vi.fn().mockResolvedValue({
          mode: "default",
          weights: mergeQuestScoringWeights(null),
        }),
      },
    };
    const { content } = await executeQuestScoringShow("g1", "c1", deps);
    expect(content).toContain("Mode: **default**");
    expect(content).not.toContain("Weights:");
    expect(content).not.toContain("tier_1");
  });

  it("includes weights with tier_* labels for weighted modes", async () => {
    const deps = {
      repo: {
        getQuestScoringConfig: vi.fn().mockResolvedValue({
          mode: "weighted_require_sum",
          weights: mergeQuestScoringWeights({
            untiered: 1,
            "1": 1,
            "2": 2,
          }),
        }),
      },
    };
    const { content } = await executeQuestScoringShow("g1", "c1", deps);
    expect(content).toContain("Mode: **weighted sum**");
    expect(content).toContain("Weights:");
    expect(content).toContain("• untiered: **1**");
    expect(content).toContain("• tier_1: **1**");
    expect(content).toContain("• tier_2: **2**");
  });
});

describe("executeQuestScoringSet", () => {
  const entityCacheRepo = {
    getItemCraftingTiers: vi.fn().mockResolvedValue(new Map()),
  };

  it("delegates to repo and formats singular recalc line", async () => {
    const setQuestScoringConfig = vi.fn().mockResolvedValue(1);
    const cfg = {
      mode: "weighted_require_max" as const,
      weights: mergeQuestScoringWeights({ "3": 9 }),
    };
    const getQuestScoringConfig = vi.fn().mockResolvedValue(cfg);
    const deps = {
      repo: { setQuestScoringConfig, getQuestScoringConfig },
      entityCacheRepo,
    };
    const { content } = await executeQuestScoringSet(
      "g1",
      "c1",
      { mode: "weighted_require_max", weightsPatch: { "3": 9 } },
      deps
    );
    expect(setQuestScoringConfig).toHaveBeenCalledWith(
      "g1",
      "c1",
      {
        mode: "weighted_require_max",
        weightsPatch: { "3": 9 },
      },
      expect.any(Function)
    );
    expect(content).toContain("**1** completion row");
    expect(content).not.toContain("completion rows");
    expect(content).toContain("Mode: **weighted max**");
    expect(content).toContain("Weights:");
    expect(content).toContain("• tier_3: **9**");
  });

  it("uses plural recalc copy and omits weights tail for default mode", async () => {
    const setQuestScoringConfig = vi.fn().mockResolvedValue(2);
    const getQuestScoringConfig = vi.fn().mockResolvedValue({
      mode: "default" as const,
      weights: mergeQuestScoringWeights(null),
    });
    const deps = {
      repo: { setQuestScoringConfig, getQuestScoringConfig },
      entityCacheRepo,
    };
    const { content } = await executeQuestScoringSet(
      "g1",
      "c1",
      { mode: "default" },
      deps
    );
    expect(content).toContain("**2** completion rows");
    expect(content).toContain("Mode: **default**");
    expect(content).not.toContain("Weights:");
  });
});
