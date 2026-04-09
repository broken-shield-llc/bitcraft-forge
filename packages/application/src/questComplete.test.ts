import { describe, expect, it, vi } from "vitest";
import { executeQuestComplete } from "./questComplete.js";

describe("executeQuestComplete", () => {
  it("rejects invalid scoped ids", async () => {
    const deps = {
      repo: {
        isBuildingMonitored: vi.fn(),
        recordQuestCompletion: vi.fn(),
      },
    };
    const { content } = await executeQuestComplete(
      {
        discordGuildId: "g1",
        forgeChannelId: "c1",
        discordUserId: "u1",
        rawBuildingId: "",
        rawQuestEntityId: "99",
      },
      deps
    );
    expect(content).toContain("Invalid");
    expect(deps.repo.isBuildingMonitored).not.toHaveBeenCalled();
  });

  it("rejects non-numeric entity ids", async () => {
    const deps = {
      repo: {
        isBuildingMonitored: vi.fn(),
        recordQuestCompletion: vi.fn(),
      },
    };
    const { content } = await executeQuestComplete(
      {
        discordGuildId: "g1",
        forgeChannelId: "c1",
        discordUserId: "u1",
        rawBuildingId: "abc",
        rawQuestEntityId: "def",
      },
      deps
    );
    expect(content).toContain("numeric BitCraft entity ids");
    expect(deps.repo.isBuildingMonitored).not.toHaveBeenCalled();
  });

  it("rejects unmonitored buildings", async () => {
    const deps = {
      repo: {
        isBuildingMonitored: vi.fn().mockResolvedValue(false),
        recordQuestCompletion: vi.fn(),
      },
    };
    const { content } = await executeQuestComplete(
      {
        discordGuildId: "g1",
        forgeChannelId: "c1",
        discordUserId: "u1",
        rawBuildingId: "10",
        rawQuestEntityId: "20",
      },
      deps
    );
    expect(content).toContain("not monitored");
    expect(deps.repo.isBuildingMonitored).toHaveBeenCalledWith("g1", "c1", "10");
    expect(deps.repo.recordQuestCompletion).not.toHaveBeenCalled();
  });

  it("records completion with d: subject and returns ok message", async () => {
    const recordQuestCompletion = vi.fn().mockResolvedValue("ok");
    const deps = {
      repo: {
        isBuildingMonitored: vi.fn().mockResolvedValue(true),
        recordQuestCompletion,
      },
    };
    const { content } = await executeQuestComplete(
      {
        discordGuildId: "g1",
        forgeChannelId: "c1",
        discordUserId: "999",
        rawBuildingId: "10",
        rawQuestEntityId: "20",
      },
      deps
    );
    expect(content).toContain("Quest completion logged");
    expect(recordQuestCompletion).toHaveBeenCalledWith(
      "g1",
      "c1",
      "10",
      "20",
      "d:999"
    );
  });

});
