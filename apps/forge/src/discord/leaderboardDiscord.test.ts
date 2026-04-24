import { describe, expect, it } from "vitest";
import { splitLeaderboardDiscordMessages } from "./forgeInteractions.js";

describe("splitLeaderboardDiscordMessages", () => {
  it("returns a single message when the body fits the first block", () => {
    const msg = "**Quest Leaderboard**\n1. a — **1** points\n2. b — **1** points";
    expect(splitLeaderboardDiscordMessages(msg, false)).toEqual([msg]);
    expect(splitLeaderboardDiscordMessages(msg, true)).toEqual([msg]);
  });

  it("splits when content without banner would exceed 2000 characters", () => {
    const line = "1. " + "x".repeat(80) + " — **1** points";
    const n = 30;
    const body = Array.from({ length: n }, (_, i) =>
      line.replace(/^1\./, `${i + 1}.`)
    ).join("\n");
    const full = `**Quest Leaderboard**\n${body}`;
    const parts = splitLeaderboardDiscordMessages(full, false);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(2000);
    }
    const joined = parts.join("\n");
    expect(joined).toContain("**Quest Leaderboard** (continued)");
  });
});
