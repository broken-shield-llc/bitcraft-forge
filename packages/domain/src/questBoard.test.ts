import { describe, expect, it } from "vitest";
import {
  canStallFulfillOfferOnce,
  isQuestOfferVisibleOnBoard,
  type StallInventoryBoardPort,
} from "./questBoard.js";
import type { QuestOfferSnapshot } from "./quest.js";

function snap(partial: Partial<QuestOfferSnapshot> & Pick<QuestOfferSnapshot, "questKey">): QuestOfferSnapshot {
  return {
    shopEntityIdStr: "10",
    orderEntityIdStr: "20",
    remainingStock: 1,
    offerSummary: "",
    requiredSummary: "",
    travelerTradeOrderId: null,
    ...partial,
  };
}

describe("canStallFulfillOfferOnce", () => {
  it("returns true when offer is empty", () => {
    expect(canStallFulfillOfferOnce([], new Map())).toBe(true);
  });

  it("requires enough of each item", () => {
    const inv = new Map<number, number>([
      [1, 5],
      [2, 1],
    ]);
    expect(
      canStallFulfillOfferOnce(
        [
          { itemId: 1, quantity: 5 },
          { itemId: 2, quantity: 1 },
        ],
        inv
      )
    ).toBe(true);
    expect(
      canStallFulfillOfferOnce([{ itemId: 1, quantity: 6 }], inv)
    ).toBe(false);
  });
});

describe("isQuestOfferVisibleOnBoard", () => {
  const unknownInv: StallInventoryBoardPort = {
    hasInventoryDataForOwner: () => false,
    getTotalsForOwner: () => new Map(),
  };

  const emptyKnown: StallInventoryBoardPort = {
    hasInventoryDataForOwner: () => true,
    getTotalsForOwner: () => new Map(),
  };

  it("hides zero stock even if inventory unknown", () => {
    expect(
      isQuestOfferVisibleOnBoard(
        snap({ questKey: "a", remainingStock: 0 }),
        unknownInv
      )
    ).toBe(false);
  });

  it("shows when inventory unknown", () => {
    expect(
      isQuestOfferVisibleOnBoard(
        snap({
          questKey: "a",
          remainingStock: 2,
          offerStacks: [{ itemId: 1, quantity: 999 }],
        }),
        unknownInv
      )
    ).toBe(true);
  });

  it("hides when known inventory cannot cover offer", () => {
    expect(
      isQuestOfferVisibleOnBoard(
        snap({
          questKey: "a",
          remainingStock: 1,
          offerStacks: [{ itemId: 1, quantity: 5 }],
        }),
        emptyKnown
      )
    ).toBe(false);
  });

  it("shows when known inventory covers offer", () => {
    const ok: StallInventoryBoardPort = {
      hasInventoryDataForOwner: () => true,
      getTotalsForOwner: () => new Map([[1, 10]]),
    };
    expect(
      isQuestOfferVisibleOnBoard(
        snap({
          questKey: "a",
          remainingStock: 1,
          offerStacks: [{ itemId: 1, quantity: 5 }],
        }),
        ok
      )
    ).toBe(true);
  });
});
