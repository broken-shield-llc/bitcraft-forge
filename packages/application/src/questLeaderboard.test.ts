import { describe, expect, it, vi } from "vitest";
import { executeQuestLeaderboard } from "./questLeaderboard.js";

describe("executeQuestLeaderboard", () => {
  it("returns empty-state copy when there are no rows", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([]),
      },
    };
    const { content } = await executeQuestLeaderboard("g1", deps);
    expect(content).toContain("No quest completions logged yet");
    expect(deps.repo.questLeaderboard).toHaveBeenCalledWith("g1", 10);
  });

  it("formats rows with Discord mention for d: subjects", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([
          { subjectKey: "d:123456789", completions: 5 },
          { subjectKey: "s:deadbeef", completions: 2 },
        ]),
      },
    };
    const { content } = await executeQuestLeaderboard("g1", deps, {
      limit: 10,
    });
    expect(content).toContain("**Quest leaderboard**");
    expect(content).toContain("1. <@123456789> — **5**");
    expect(content).toContain("2. STDB `deadbeef` — **2**");
  });

  it("respects custom limit", async () => {
    const deps = {
      repo: {
        questLeaderboard: vi.fn().mockResolvedValue([]),
      },
    };
    await executeQuestLeaderboard("g1", deps, { limit: 25 });
    expect(deps.repo.questLeaderboard).toHaveBeenCalledWith("g1", 25);
  });
});
