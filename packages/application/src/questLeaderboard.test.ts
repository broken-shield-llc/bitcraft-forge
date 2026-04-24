import { describe, expect, it, vi } from "vitest";
import {
  executeQuestLeaderboard,
  executeQuestLeaderboardReset,
} from "./questLeaderboard.js";

describe("executeQuestLeaderboardReset", () => {
  it("reports zero rows when nothing was deleted", async () => {
    const deps = {
      repo: {
        clearQuestCompletionsForScope: vi.fn().mockResolvedValue(0),
      },
    };
    const { content } = await executeQuestLeaderboardReset("g1", "c1", deps);
    expect(content).toContain("**Quest Leaderboard**");
    expect(content).toContain("already empty");
    expect(deps.repo.clearQuestCompletionsForScope).toHaveBeenCalledWith(
      "g1",
      "c1"
    );
  });

  it("reports singular row when one deleted", async () => {
    const deps = {
      repo: {
        clearQuestCompletionsForScope: vi.fn().mockResolvedValue(1),
      },
    };
    const { content } = await executeQuestLeaderboardReset("g1", "c1", deps);
    expect(content).toContain("**Quest Leaderboard**");
    expect(content).toContain("reset");
    expect(content).toContain("**1** quest completion");
  });

  it("reports plural rows when multiple deleted", async () => {
    const deps = {
      repo: {
        clearQuestCompletionsForScope: vi.fn().mockResolvedValue(12),
      },
    };
    const { content } = await executeQuestLeaderboardReset("g1", "c1", deps);
    expect(content).toContain("**12** quest completions");
  });
});

describe("executeQuestLeaderboard", () => {
  const entityCacheRepo = {
    getTravelerUsernameForIdentity: vi.fn().mockResolvedValue(undefined),
  };

  it("returns empty-state copy when there are no rows", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([]),
      },
      entityCacheRepo,
    };
    const { content } = await executeQuestLeaderboard("g1", "c1", deps);
    expect(content).toContain("**Quest Leaderboard**");
    expect(content).toContain("No quest completions yet");
    expect(deps.repo.questLeaderboard).toHaveBeenCalledWith("g1", "c1", null);
  });

  it("formats rows with Discord mention for d: subjects", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([
          {
            subjectKey: "d:123456789",
            points: 5,
            subjectDisplayName: null,
            subjectTravelerEntityId: null,
          },
          {
            subjectKey: "s:deadbeef",
            points: 2,
            subjectDisplayName: null,
            subjectTravelerEntityId: null,
          },
        ]),
      },
      entityCacheRepo,
    };
    const { content } = await executeQuestLeaderboard("g1", "c1", deps, {
      limit: 10,
    });
    expect(content).toContain("**Quest Leaderboard**");
    expect(content).toContain("1. <@123456789> — **5** points");
    expect(content).toContain("2. Traveler — **2** points");
    expect(deps.entityCacheRepo.getTravelerUsernameForIdentity).toHaveBeenCalledWith(
      "deadbeef"
    );
  });

  it("uses cached in-game username for s: subjects when available", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([
          {
            subjectKey: "s:abc",
            points: 1,
            subjectDisplayName: null,
            subjectTravelerEntityId: null,
          },
        ]),
      },
      entityCacheRepo: {
        getTravelerUsernameForIdentity: vi.fn().mockResolvedValue("TraderJo"),
      },
    };
    const { content } = await executeQuestLeaderboard("g1", "c1", deps);
    expect(deps.repo.questLeaderboard).toHaveBeenCalledWith("g1", "c1", null);
    expect(content).toContain("1. TraderJo — **1** points");
  });

  it("shows plain Traveler when no stored name and no live cache name", async () => {
    const longHex = "a".repeat(16) + "b".repeat(16);
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([
          {
            subjectKey: `s:${longHex}`,
            points: 3,
            subjectDisplayName: null,
            subjectTravelerEntityId: null,
          },
        ]),
      },
      entityCacheRepo: {
        getTravelerUsernameForIdentity: vi.fn().mockResolvedValue(undefined),
      },
    };
    const { content } = await executeQuestLeaderboard("g1", "c1", deps);
    expect(content).toContain("1. Traveler — **3** points");
  });

  it("prefers subject_display_name from quest rows over live cache for s: subjects", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([
          {
            subjectKey: "s:abc",
            points: 1,
            subjectDisplayName: "SavedAtCompletion",
            subjectTravelerEntityId: null,
          },
        ]),
      },
      entityCacheRepo: {
        getTravelerUsernameForIdentity: vi
          .fn()
          .mockResolvedValue("DifferentFromCache"),
      },
    };
    const { content } = await executeQuestLeaderboard("g1", "c1", deps);
    expect(content).toContain("1. SavedAtCompletion — **1** points");
  });

  it("respects custom limit when passed explicitly", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([]),
      },
      entityCacheRepo,
    };
    await executeQuestLeaderboard("g1", "c1", deps, { limit: 25 });
    expect(deps.repo.questLeaderboard).toHaveBeenCalledWith("g1", "c1", 25);
  });
});
