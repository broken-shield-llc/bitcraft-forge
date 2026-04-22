import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQuestBoardDetailState,
  getQuestBoardDetailState,
  setQuestBoardDetailState,
} from "./questBoardDetailState.js";

const MID = "quest-board-detail-test-msg-1";
const HH = 2 * 60 * 60 * 1000;

describe("questBoardDetailState", () => {
  beforeEach(() => {
    clearQuestBoardDetailState(MID);
  });

  afterEach(() => {
    clearQuestBoardDetailState(MID);
  });

  it("round-trips set and get", () => {
    setQuestBoardDetailState(MID, {
      shopEntityIdStr: "10",
      offerPage: 1,
      totalOfferPages: 3,
    });
    const s = getQuestBoardDetailState(MID);
    expect(s).toMatchObject({
      shopEntityIdStr: "10",
      offerPage: 1,
      totalOfferPages: 3,
    });
    expect(typeof s?.updatedAtMs).toBe("number");
  });

  it("get returns undefined after clear", () => {
    setQuestBoardDetailState(MID, {
      shopEntityIdStr: "a",
      offerPage: 0,
      totalOfferPages: 1,
    });
    clearQuestBoardDetailState(MID);
    expect(getQuestBoardDetailState(MID)).toBeUndefined();
  });

  it("drops state after TTL on get", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
      setQuestBoardDetailState(MID, {
        shopEntityIdStr: "a",
        offerPage: 0,
        totalOfferPages: 1,
      });
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z").getTime() + HH + 1);
      expect(getQuestBoardDetailState(MID)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
