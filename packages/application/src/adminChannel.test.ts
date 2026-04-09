import { describe, expect, it, vi } from "vitest";
import { executeSetAnnouncementChannel } from "./adminChannel.js";

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
    expect(content).toContain("paused");
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
