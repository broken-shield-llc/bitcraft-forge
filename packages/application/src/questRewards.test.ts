import { describe, expect, it, vi } from "vitest";
import type { QuestOfferReadPort, QuestOfferSnapshot } from "@forge/domain";
import {
  executeQuestRewardsList,
  executeQuestRewardsTotalsDetail,
  QUEST_REWARDS_ALL_STORES_VALUE,
  QUEST_REWARDS_DISCORD_TITLE,
  QUEST_REWARDS_LEGACY_EPHEMERAL_TITLE,
  splitQuestRewardsForDiscord,
} from "./questRewards.js";

function offer(
  partial: Partial<QuestOfferSnapshot> &
    Pick<QuestOfferSnapshot, "questKey" | "shopEntityIdStr">
): QuestOfferSnapshot {
  return {
    orderEntityIdStr: "1",
    remainingStock: 1,
    offerSummary: "",
    requiredSummary: "",
    travelerTradeOrderId: null,
    ...partial,
  };
}

function baseRewardsDeps(questOffersMock: QuestOfferReadPort) {
  return {
    repo: { listBuildings: vi.fn() },
    entityCacheRepo: {
      getItemNames: vi.fn().mockResolvedValue(new Map<number, string>()),
      getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
      getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
    },
    questOffers: questOffersMock,
  };
}

describe("splitQuestRewardsForDiscord", () => {
  it("returns a single chunk when short", () => {
    const s = `${QUEST_REWARDS_DISCORD_TITLE}\n\n**Total**\nA ×1`;
    expect(splitQuestRewardsForDiscord(s)).toEqual([s]);
  });

  it("handles legacy Stall reward shopping list title", () => {
    const s = `${QUEST_REWARDS_LEGACY_EPHEMERAL_TITLE}\n\n**Total**\nZ ×1`;
    if (s.length <= 2000)
      expect(splitQuestRewardsForDiscord(s)[0]?.length).toBeLessThanOrEqual(
        2000
      );
  });
});

describe("executeQuestRewardsList", () => {
  it("returns no_buildings when nothing monitored", async () => {
    const deps = {
      ...baseRewardsDeps({ snapshotForMonitoredBuildings: vi.fn() }),
      repo: {
        listBuildings: vi.fn().mockResolvedValue([]),
      },
    };
    const r = await executeQuestRewardsList("g1", "c1", deps, 0);
    expect(r.kind).toBe("no_buildings");
  });

  it("lists shops with picker rows when orders exist", async () => {
    const snap = vi.fn().mockImplementation((ids: Set<string>) =>
      [...ids].flatMap(() => [
        offer({
          questKey: "10:1",
          shopEntityIdStr: "10",
          remainingStock: 3,
          offerStacks: [{ itemId: 1, quantity: 1 }],
        }),
      ])
    );
    const deps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(new Map([["10", "Corner stall"]])),
        getItemNames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: { snapshotForMonitoredBuildings: snap },
    };
    const r = await executeQuestRewardsList("g1", "c1", deps, 0);
    expect(r.kind).toBe("list");
    if (r.kind === "list") {
      expect(r.shops).toHaveLength(1);
      expect(r.shops[0]!.shopEntityIdStr).toBe("10");
      expect(r.content).toContain(QUEST_REWARDS_DISCORD_TITLE);
    }
  });
});

describe("executeQuestRewardsTotalsDetail", () => {
  it("aggregates rewards for ALL_STORES sentinel", async () => {
    const deps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
        getItemNames: vi
          .fn()
          .mockResolvedValue(new Map<number, string | undefined>([[1, "Tea"]])),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([
          offer({
            questKey: "10:1",
            shopEntityIdStr: "10",
            remainingStock: 2,
            offerStacks: [{ itemId: 1, quantity: 3 }],
          }),
        ]),
      },
    };

    const d = await executeQuestRewardsTotalsDetail(
      "g1",
      "c1",
      deps,
      QUEST_REWARDS_ALL_STORES_VALUE,
      0
    );
    expect(d.kind).toBe("ok");
    if (d.kind === "ok") {
      expect(d.content).toContain("**All stores** (1 offer)");
      expect(d.content).toContain("Tea ×6");
      expect(d.content).toContain("**Total**");
    }
  });

  it("scopes to one shop id", async () => {
    const snap = vi.fn().mockImplementation((ids: Set<string>) => {
      const want = [...ids];
      expect(want.includes("10") && want.includes("20")).toBe(true);
      return [
        offer({
          questKey: "10:8",
          shopEntityIdStr: "10",
          remainingStock: 1,
          offerStacks: [{ itemId: 3, quantity: 1 }],
        }),
        offer({
          questKey: "20:9",
          shopEntityIdStr: "20",
          remainingStock: 1,
          offerStacks: [{ itemId: 4, quantity: 9 }],
        }),
      ];
    });
    const deps = {
      repo: {
        listBuildings: vi
          .fn()
          .mockResolvedValue([
            { buildingId: "10" },
            { buildingId: "20" },
          ]),
      },
      entityCacheRepo: {
        getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
        getItemNames: vi.fn().mockResolvedValue(new Map([[4, "X"]])),
      },
      questOffers: { snapshotForMonitoredBuildings: snap },
    };

    const d = await executeQuestRewardsTotalsDetail("g1", "c1", deps, "20", 0);
    expect(d.kind).toBe("ok");
    if (d.kind === "ok") expect(d.content).toContain("X ×9");
  });
});
