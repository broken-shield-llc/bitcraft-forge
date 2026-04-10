import { describe, expect, it } from "vitest";
import type { QuestOfferSnapshot } from "@forge/domain";
import { buildQuestCompletionEmbed, buildQuestOfferEmbed } from "./questEmbed.js";

function baseSnap(over: Partial<QuestOfferSnapshot>): QuestOfferSnapshot {
  return {
    questKey: "1:2",
    shopEntityIdStr: "1",
    orderEntityIdStr: "2",
    remainingStock: 3,
    offerSummary: "1×1",
    requiredSummary: "2×2",
    travelerTradeOrderId: null,
    ...over,
  };
}

describe("buildQuestOfferEmbed", () => {
  it("sets Quest Updated title and Offer / Request / Stock fields", () => {
    const embed = buildQuestOfferEmbed(baseSnap({}), {
      kind: "update",
      claimName: "My Claim",
      shopNickname: "Shop Nick",
    });
    const j = embed.toJSON();
    expect(j.title).toBe("Quest Updated in My Claim - Shop Nick");
    expect(j.color).toBe(0x3498db);
    expect(j.fields?.map((f) => f.name)).toEqual(["Offer", "Request", "Stock"]);
    expect(j.fields?.find((f) => f.name === "Stock")?.value).toBe("3");
    expect(j.fields?.find((f) => f.name === "Offer")?.value).toBe("1×1");
    expect(j.timestamp).toBeDefined();
  });

  it("uses Quest Added for kind new", () => {
    const embed = buildQuestOfferEmbed(baseSnap({}), {
      kind: "new",
      claimName: "C",
      shopNickname: "S",
    });
    expect(embed.toJSON().title).toBe("Quest Added in C - S");
  });

  it("uses em dash placeholders when claim or shop missing", () => {
    const embed = buildQuestOfferEmbed(baseSnap({}), { kind: "update" });
    expect(embed.toJSON().title).toBe("Quest Updated in — - —");
  });

  it("truncates title to Discord max length", () => {
    const long = "x".repeat(300);
    const embed = buildQuestOfferEmbed(baseSnap({}), {
      kind: "update",
      claimName: long,
      shopNickname: long,
    });
    const title = embed.toJSON().title;
    expect(title?.length).toBeLessThanOrEqual(256);
    expect(title?.endsWith("…")).toBe(true);
  });

  it("uses override summaries when provided", () => {
    const embed = buildQuestOfferEmbed(baseSnap({ offerSummary: "old" }), {
      offerSummary: "Gold ×1",
      requiredSummary: "Iron ×2",
    });
    const j = embed.toJSON();
    expect(j.fields?.find((f) => f.name === "Offer")?.value).toBe("Gold ×1");
    expect(j.fields?.find((f) => f.name === "Request")?.value).toBe("Iron ×2");
  });

  it("defaults kind to update when omitted", () => {
    const embed = buildQuestOfferEmbed(baseSnap({}), {
      claimName: "X",
      shopNickname: "Y",
    });
    expect(embed.toJSON().title).toBe("Quest Updated in X - Y");
  });
});

describe("buildQuestCompletionEmbed", () => {
  it("uses completion title, green color, trader, offer, request, stock", () => {
    const embed = buildQuestCompletionEmbed({
      claimName: "North",
      shopNickname: "Stall",
      traderDisplay: "PlayerOne",
      offerSummary: "Gold ×1",
      requiredSummary: "Iron ×2",
      remainingStock: 0,
    });
    const j = embed.toJSON();
    expect(j.title).toBe("Quest completed in North - Stall");
    expect(j.color).toBe(0x27ae60);
    expect(j.fields?.map((f) => f.name)).toEqual([
      "Trader",
      "Offer",
      "Request",
      "Stock",
    ]);
    expect(j.fields?.find((f) => f.name === "Trader")?.value).toBe("PlayerOne");
    expect(j.fields?.find((f) => f.name === "Offer")?.value).toBe("Gold ×1");
    expect(j.fields?.find((f) => f.name === "Request")?.value).toBe("Iron ×2");
    expect(j.fields?.find((f) => f.name === "Stock")?.value).toBe("0");
  });

  it("omits Stock when remainingStock is undefined", () => {
    const embed = buildQuestCompletionEmbed({
      traderDisplay: "STDB `abc`",
      offerSummary: "—",
      requiredSummary: "—",
    });
    expect(embed.toJSON().fields?.map((f) => f.name)).toEqual([
      "Trader",
      "Offer",
      "Request",
    ]);
  });
});
