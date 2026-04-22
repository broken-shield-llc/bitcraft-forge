import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQuestBoardListRequireQuery,
  getQuestBoardListRequireQuery,
  setQuestBoardListRequireQuery,
} from "./questBoardRequireState.js";

const MID = "msg-require-test-1";
const HH = 2 * 60 * 60 * 1000;

describe("questBoardRequireState", () => {
  beforeEach(() => {
    clearQuestBoardListRequireQuery(MID);
  });

  afterEach(() => {
    clearQuestBoardListRequireQuery(MID);
  });

  it("set and get round-trip", () => {
    setQuestBoardListRequireQuery(MID, "ingot");
    expect(getQuestBoardListRequireQuery(MID)).toBe("ingot");
  });

  it("get is undefined after clear or null", () => {
    setQuestBoardListRequireQuery(MID, "x");
    setQuestBoardListRequireQuery(MID, null);
    expect(getQuestBoardListRequireQuery(MID)).toBeUndefined();
  });

  it("drops after TTL", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      setQuestBoardListRequireQuery(MID, "q");
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z").getTime() + HH + 1);
      expect(getQuestBoardListRequireQuery(MID)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
