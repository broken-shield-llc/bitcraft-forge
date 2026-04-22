import { describe, expect, it } from "vitest";
import {
  formatCompletionSubjectDisplay,
  formatItemStacks,
  formatItemStacksWithNames,
  formatOfferStacksHighlightingLegendaryPlus,
  parseEntityIdString,
  questKeyFromParts,
  isLegendaryPlusRarityTag,
  questBoardLegendaryPlusRowBadge,
  rewardRatingLabel,
  offerRequiresNameContains,
  sortQuestOffersForBoard,
} from "./quest.js";

describe("parseEntityIdString", () => {
  it("parses decimal bigint strings", () => {
    expect(parseEntityIdString("12345")).toBe(12345n);
  });

  it("rejects invalid", () => {
    expect(parseEntityIdString("")).toBeNull();
    expect(parseEntityIdString("abc")).toBeNull();
  });
});

describe("questKeyFromParts", () => {
  it("is stable", () => {
    expect(questKeyFromParts(10n, 2n)).toBe("10:2");
  });
});

describe("formatItemStacks", () => {
  it("formats stacks", () => {
    expect(
      formatItemStacks([
        { itemId: 1, quantity: 2 },
        { itemId: 99, quantity: 1 },
      ])
    ).toBe("1×2, 99×1");
  });

  it("handles empty", () => {
    expect(formatItemStacks([])).toBe("—");
  });
});

describe("formatItemStacksWithNames", () => {
  it("uses names when provided", () => {
    const m = new Map<number, string | undefined>([
      [1, "Wood"],
      [2, "Stone"],
    ]);
    expect(
      formatItemStacksWithNames(
        [
          { itemId: 1, quantity: 2 },
          { itemId: 2, quantity: 1 },
        ],
        m
      )
    ).toBe("Wood ×2, Stone ×1");
  });
});

describe("reward rating helpers", () => {
  it("flags Legendary and Mythic as Legendary+", () => {
    expect(isLegendaryPlusRarityTag("Legendary")).toBe(true);
    expect(isLegendaryPlusRarityTag("Mythic")).toBe(true);
    expect(isLegendaryPlusRarityTag("Epic")).toBe(false);
  });

  it("labels SPECIAL for legendary_plus rating", () => {
    expect(rewardRatingLabel("legendary_plus")).toBe("SPECIAL");
  });

  it("quest board badge is bold and decorated", () => {
    expect(questBoardLegendaryPlusRowBadge()).toContain("SPECIAL");
    expect(questBoardLegendaryPlusRowBadge()).toContain("✦");
  });
});

describe("formatOfferStacksHighlightingLegendaryPlus", () => {
  it("bold-underlines Legendary or Mythic reward stacks only", () => {
    const names = new Map<number, string | undefined>([
      [1, "Epic Loot"],
      [2, "Iron"],
    ]);
    const tags = new Map<number, string | undefined>([
      [1, "Legendary"],
      [2, "Common"],
    ]);
    const out = formatOfferStacksHighlightingLegendaryPlus(
      [
        { itemId: 1, quantity: 1 },
        { itemId: 2, quantity: 3 },
      ],
      names,
      tags
    );
    expect(out).toContain("**__Epic Loot ×1__**");
    expect(out).toContain("Iron ×3");
    expect(out).not.toContain("**__Iron");
  });
});

describe("formatCompletionSubjectDisplay", () => {
  it("formats discord subjects", () => {
    expect(formatCompletionSubjectDisplay("d:123456789")).toBe("<@123456789>");
  });

  it("formats stdb identity subjects", () => {
    expect(formatCompletionSubjectDisplay("s:abcdef0123456789")).toContain("STDB");
  });
});

describe("offerRequiresNameContains", () => {
  const base: Parameters<typeof offerRequiresNameContains>[0] = {
    questKey: "1:1",
    shopEntityIdStr: "1",
    orderEntityIdStr: "1",
    remainingStock: 1,
    offerSummary: "",
    requiredSummary: "x",
    travelerTradeOrderId: null,
  };
  const names = new Map<number, string | undefined>([[2, "Iron Ingot"]]);

  it("is true when any required name includes query (queryLower; names matched case-insensitively)", () => {
    expect(offerRequiresNameContains({ ...base, requiredStacks: [{ itemId: 2, quantity: 1 }] }, names, "ingot")).toBe(
      true
    );
    expect(offerRequiresNameContains({ ...base, requiredStacks: [{ itemId: 2, quantity: 1 }] }, names, "iron")).toBe(
      true
    );
  });

  it("is false with no required stacks or no match", () => {
    expect(offerRequiresNameContains({ ...base, requiredStacks: [] }, names, "ingot")).toBe(false);
    expect(offerRequiresNameContains({ ...base, requiredStacks: [{ itemId: 2, quantity: 1 }] }, names, "gold")).toBe(
      false
    );
  });
});

describe("sortQuestOffersForBoard", () => {
  it("orders by key", () => {
    const a = {
      questKey: "b",
      shopEntityIdStr: "1",
      orderEntityIdStr: "1",
      remainingStock: 1,
      offerSummary: "",
      requiredSummary: "",
      travelerTradeOrderId: null,
    };
    const b = {
      questKey: "a",
      shopEntityIdStr: "1",
      orderEntityIdStr: "2",
      remainingStock: 1,
      offerSummary: "",
      requiredSummary: "",
      travelerTradeOrderId: null,
    };
    const out = sortQuestOffersForBoard([a, b]);
    expect(out[0].questKey).toBe("a");
    expect(out[1].questKey).toBe("b");
  });
});
