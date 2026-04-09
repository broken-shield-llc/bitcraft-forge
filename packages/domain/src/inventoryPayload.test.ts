import { describe, expect, it } from "vitest";
import { aggregateItemTotalsFromInventoryPayload } from "./inventoryPayload.js";

describe("aggregateItemTotalsFromInventoryPayload", () => {
  it("sums pocket contents", () => {
    const m = aggregateItemTotalsFromInventoryPayload({
      pockets: [
        { contents: { itemId: 1, quantity: 2 } },
        { contents: { itemId: 1, quantity: 3 } },
      ],
    });
    expect(m.get(1)).toBe(5);
  });

  it("returns empty map when no pockets", () => {
    expect(
      aggregateItemTotalsFromInventoryPayload({}).size
    ).toBe(0);
  });
});
