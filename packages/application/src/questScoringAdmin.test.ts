import { describe, expect, it, vi } from "vitest";
import { mergeQuestScoringWeights } from "@forge/domain";
import {
  executeQuestScoringSet,
  executeQuestScoringShow,
} from "./questScoringAdmin.js";

const entityCacheRepo = {
  getItemCraftingTiers: vi.fn().mockResolvedValue(new Map()),
};

describe("executeQuestScoringShow", () => {
  const showRepo = {
    getQuestScoringConfig: vi.fn(),
    setQuestScoringConfig: vi.fn(),
  };

  it("returns not-enabled copy when config is missing", async () => {
    showRepo.getQuestScoringConfig.mockResolvedValue(null);
    const deps = { repo: showRepo, entityCacheRepo };
    const { content } = await executeQuestScoringShow("g1", "c1", deps);
    expect(content).toContain("not forge-enabled");
    expect(showRepo.getQuestScoringConfig).toHaveBeenCalledWith("g1", "c1");
  });

  it("omits weights for default mode", async () => {
    showRepo.getQuestScoringConfig.mockResolvedValue({
      mode: "default",
      weights: mergeQuestScoringWeights(null),
    });
    const deps = { repo: showRepo, entityCacheRepo };
    const { content } = await executeQuestScoringShow("g1", "c1", deps);
    expect(content).toContain("Mode: **default**");
    expect(content).not.toContain("Weights:");
    expect(content).not.toContain("tier_1");
  });

  it("includes weights with tier_* labels for weighted modes", async () => {
    showRepo.getQuestScoringConfig.mockResolvedValue({
      mode: "weighted_require_sum",
      weights: mergeQuestScoringWeights({
        untiered: 1,
        "1": 1,
        "2": 2,
      }),
    });
    const deps = { repo: showRepo, entityCacheRepo };
    const { content } = await executeQuestScoringShow("g1", "c1", deps);
    expect(content).toContain("Mode: **weighted sum**");
    expect(content).toContain("Weights:");
    expect(content).toContain("• untiered: **1**");
    expect(content).toContain("• tier_1: **1**");
    expect(content).toContain("• tier_2: **2**");
  });
});

describe("executeQuestScoringSet", () => {
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
