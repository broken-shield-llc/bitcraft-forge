import { describe, expect, it, vi } from "vitest";
import {
  executeSetAnnouncementChannel,
  executeSetQuestAnnouncementTarget,
} from "./adminChannel.js";

describe("executeSetQuestAnnouncementTarget", () => {
  it("sets quest completion override", async () => {
    const setQuestAnnouncementOverride = vi.fn().mockResolvedValue(undefined);
    const { content } = await executeSetQuestAnnouncementTarget(
      "g1",
      "c1",
      "quest_completion",
      "999",
      {
        repo: {
          setAnnouncementChannel: vi.fn(),
          setQuestAnnouncementOverride,
        },
      }
    );
    expect(setQuestAnnouncementOverride).toHaveBeenCalledWith(
      "g1",
      "c1",
      "quest_completion",
      "999"
    );
    expect(content).toContain("Quest **completion**");
    expect(content).toContain("<#999>");
  });
});

describe("executeSetAnnouncementChannel", () => {
  it("persists null and returns cleared copy", async () => {
    const setAnnouncementChannel = vi.fn().mockResolvedValue(undefined);
    const { content } = await executeSetAnnouncementChannel(
      "g1",
      "c1",
      null,
      { repo: { setAnnouncementChannel } }
    );
    expect(setAnnouncementChannel).toHaveBeenCalledWith("g1", "c1", null);
    expect(content).toContain("Cleared");
    expect(content).toContain("default");
    expect(content).toContain("overrides");
  });

  it("persists channel id and returns mention line", async () => {
    const setAnnouncementChannel = vi.fn().mockResolvedValue(undefined);
    const { content } = await executeSetAnnouncementChannel(
      "g1",
      "c1",
      "9876543210",
      { repo: { setAnnouncementChannel } }
    );
    expect(setAnnouncementChannel).toHaveBeenCalledWith(
      "g1",
      "c1",
      "9876543210"
    );
    expect(content).toContain("<#9876543210>");
  });
});
