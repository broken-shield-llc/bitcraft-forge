import type { InteractionEditReplyOptions } from "discord.js";
import { describe, expect, it } from "vitest";
import type { QuestBoardListResult } from "@forge/application";
import {
  buildQuestBoardDetailComponents,
  buildQuestBoardEmbeds,
  buildQuestBoardListComponents,
  isForgeQuestBoardComponent,
  parseForgeQuestBoardCustomId,
  questBoardEditPayload,
  stripQuestBoardTitleLine,
} from "./questBoardDiscord.js";

describe("stripQuestBoardTitleLine", () => {
  it("removes leading **Quest board** and following newline", () => {
    expect(stripQuestBoardTitleLine("**Quest board**\n\nHello")).toBe("Hello");
    expect(stripQuestBoardTitleLine("**Quest board**\nHello")).toBe("Hello");
  });

  it("removes the search variant first line for banner embeds", () => {
    expect(
      stripQuestBoardTitleLine("**Quest board** — search: **ingot**\n\nNext")
    ).toBe("Next");
  });


  it("leaves text without title unchanged", () => {
    expect(stripQuestBoardTitleLine("No title here")).toBe("No title here");
  });
});

describe("buildQuestBoardEmbeds", () => {
  it("returns plain content and no embeds when banner URL is unset", () => {
    const full = "**Quest board**\n\nLine two";
    const r = buildQuestBoardEmbeds(full, undefined);
    expect(r.content).toBe(full);
    expect(r.embeds).toHaveLength(0);
  });

  it("returns plain content when banner URL is whitespace", () => {
    const r = buildQuestBoardEmbeds("body", "  \t  ");
    expect(r.content).toBe("body");
    expect(r.embeds).toHaveLength(0);
  });

  it("uses two embeds and strips title when banner is set", () => {
    const r = buildQuestBoardEmbeds(
      "**Quest board**\n\nSummary line",
      "https://cdn.example.com/banner.png"
    );
    expect(r.content).toBe("");
    expect(r.embeds).toHaveLength(2);
    const a = r.embeds[0]!.toJSON();
    const b = r.embeds[1]!.toJSON();
    expect(a.image?.url).toBe("https://cdn.example.com/banner.png");
    expect(a.color).toBe(0x2b2d31);
    expect(b.description).toBe("Summary line");
    expect(b.color).toBe(0x2b2d31);
  });
});

describe("questBoardEditPayload", () => {
  it("merges embed payload with optional components", () => {
    const list = {
      kind: "list" as const,
      content: "",
      totalShops: 1,
      totalOffers: 1,
      page: 0,
      pageSize: 25,
      totalPages: 1,
      shops: [
        {
          shopEntityIdStr: "10",
          label: "Shop A · 1 offer",
          offerCount: 1,
        },
      ],
      requireQuery: null,
    } satisfies Extract<QuestBoardListResult, { kind: "list" }>;

    const components = buildQuestBoardListComponents(list, "900000000000000001");
    const payload = questBoardEditPayload(
      "**Quest board**\n\nPick below",
      "https://x.test/b.png",
      components as InteractionEditReplyOptions["components"]
    );
    expect(payload.content).toBe("");
    expect(payload.embeds).toHaveLength(2);
    expect(payload.components).toBe(components);
  });
});

describe("parseForgeQuestBoardCustomId", () => {
  it("parses shop detail prev/next", () => {
    expect(parseForgeQuestBoardCustomId("forge_qb_dprev|900000000000000001")).toEqual(
      { type: "detail_prev", forgeChannelId: "900000000000000001" }
    );
    expect(parseForgeQuestBoardCustomId("forge_qb_dnext|900000000000000001")).toEqual(
      { type: "detail_next", forgeChannelId: "900000000000000001" }
    );
  });
});

describe("isForgeQuestBoardComponent", () => {
  it("is true for known quest board custom ids (including shop detail nav)", () => {
    expect(isForgeQuestBoardComponent("forge_qb_shop|1")).toBe(true);
    expect(isForgeQuestBoardComponent("forge_qb_back|1")).toBe(true);
    expect(isForgeQuestBoardComponent("forge_qb_page|0|1")).toBe(true);
    expect(isForgeQuestBoardComponent("forge_qb_dprev|1")).toBe(true);
    expect(isForgeQuestBoardComponent("forge_qb_dnext|1")).toBe(true);
  });

  it("is false for unrelated ids", () => {
    expect(isForgeQuestBoardComponent("other_btn|1")).toBe(false);
  });
});

describe("buildQuestBoardDetailComponents", () => {
  it("returns one row with back and prev/next", () => {
    const rows = buildQuestBoardDetailComponents("900000000000000001", {
      currentOfferPage: 1,
      totalOfferPages: 3,
    });
    expect(rows).toHaveLength(1);
    const row0 = rows[0]!.toJSON();
    expect(row0.components).toHaveLength(3);
  });

  it("disables both nav when only one offer page", () => {
    const rows = buildQuestBoardDetailComponents("900000000000000001", {
      currentOfferPage: 0,
      totalOfferPages: 1,
    });
    const cs = rows[0]!.toJSON().components as { disabled?: boolean; label: string }[];
    const prevB = cs.find((c) => c.label === "Previous");
    const nextB = cs.find((c) => c.label === "Next");
    expect(prevB?.disabled).toBe(true);
    expect(nextB?.disabled).toBe(true);
  });
});
