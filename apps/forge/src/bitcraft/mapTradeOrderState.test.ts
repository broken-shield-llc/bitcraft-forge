import type { TradeOrderState } from "@bitcraft/bindings";
import { describe, expect, it } from "vitest";
import { mapTradeOrderToSnapshot } from "./mapTradeOrderState.js";

function stack(
  itemId: number,
  quantity: number
): TradeOrderState["offerItems"][number] {
  return {
    itemId,
    quantity,
    itemType: { tag: "Item" },
    durability: undefined,
  };
}

describe("mapTradeOrderToSnapshot", () => {
  it("builds questKey and string ids from bigint entity ids", () => {
    const row: TradeOrderState = {
      entityId: 42n,
      shopEntityId: 100n,
      remainingStock: 5,
      offerItems: [stack(7, 1)],
      offerCargoId: [],
      requiredItems: [stack(8, 2)],
      requiredCargoId: [],
      travelerTradeOrderId: undefined,
    };
    const snap = mapTradeOrderToSnapshot(row);
    expect(snap.questKey).toBe("100:42");
    expect(snap.shopEntityIdStr).toBe("100");
    expect(snap.orderEntityIdStr).toBe("42");
    expect(snap.remainingStock).toBe(5);
    expect(snap.travelerTradeOrderId).toBeNull();
    expect(snap.offerStacks).toEqual([{ itemId: 7, quantity: 1 }]);
    expect(snap.requiredStacks).toEqual([{ itemId: 8, quantity: 2 }]);
    expect(snap.offerSummary).toContain("7");
    expect(snap.requiredSummary).toContain("8");
  });

  it("maps defined travelerTradeOrderId", () => {
    const row: TradeOrderState = {
      entityId: 1n,
      shopEntityId: 2n,
      remainingStock: 0,
      offerItems: [],
      offerCargoId: [],
      requiredItems: [],
      requiredCargoId: [],
      travelerTradeOrderId: 99,
    };
    expect(mapTradeOrderToSnapshot(row).travelerTradeOrderId).toBe(99);
  });
});
