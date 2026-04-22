import { describe, expect, it, vi } from "vitest";
import type { QuestOfferSnapshot } from "@forge/domain";
import {
  executeQuestBoardList,
  executeQuestBoardShopDetail,
  type QuestBoardDeps,
} from "./questBoard.js";

function baseOffer(partial: Partial<QuestOfferSnapshot>): QuestOfferSnapshot {
  return {
    questKey: "1:2",
    shopEntityIdStr: "10",
    orderEntityIdStr: "20",
    remainingStock: 3,
    offerSummary: "offer",
    requiredSummary: "req",
    travelerTradeOrderId: null,
    ...partial,
  };
}

describe("executeQuestBoardList", () => {
  it("returns empty message when there are no monitored buildings", async () => {
    const deps: QuestBoardDeps = {
      repo: { listBuildings: vi.fn().mockResolvedValue([]) },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi.fn().mockResolvedValue(
          new Map()
        ),
        getItemNames: vi.fn().mockResolvedValue(new Map()),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([]),
      },
    };
    const r = await executeQuestBoardList("g1", "c1", deps, 0);
    expect(r.kind).toBe("no_buildings");
    if (r.kind === "no_buildings") {
      expect(r.content).toContain("No monitored buildings in this channel yet");
    }
    expect(deps.questOffers.snapshotForMonitoredBuildings).not.toHaveBeenCalled();
  });

  it("returns guidance when buildings exist but no visible offers", async () => {
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi.fn().mockResolvedValue(
          new Map()
        ),
        getItemNames: vi.fn().mockResolvedValue(new Map()),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([]),
      },
    };
    const r = await executeQuestBoardList("g1", "c1", deps, 0);
    expect(r.kind).toBe("no_offers");
    if (r.kind === "no_offers") {
      expect(r.content).toContain("No quests in the live cache");
    }
  });

  it("returns interactive list with shops when offers exist", async () => {
    const offer = baseOffer({
      questKey: "10:99",
      shopEntityIdStr: "10",
      offerStacks: [{ itemId: 1, quantity: 2 }],
      requiredStacks: [{ itemId: 2, quantity: 1 }],
    });
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi
          .fn()
          .mockResolvedValue(new Map()),
        getItemNames: vi
          .fn()
          .mockResolvedValue(
            new Map<number, string | undefined>([
              [1, "Gold"],
              [2, "Iron"],
            ])
          ),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(new Map([["10", "Stall One"]])),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([offer]),
      },
    };
    const r = await executeQuestBoardList("g1", "c1", deps, 0);
    expect(r.kind).toBe("list");
    if (r.kind === "list") {
      expect(r.content).toContain("**Quest board**");
      expect(r.shops).toHaveLength(1);
      expect(r.shops[0]?.shopEntityIdStr).toBe("10");
      expect(r.shops[0]?.label).toContain("Stall One");
    }
  });
});

describe("executeQuestBoardShopDetail", () => {
  it("renders offers with nicknames and item names", async () => {
    const offer = baseOffer({
      questKey: "10:99",
      shopEntityIdStr: "10",
      offerStacks: [{ itemId: 1, quantity: 2 }],
      requiredStacks: [{ itemId: 2, quantity: 1 }],
    });
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi
          .fn()
          .mockResolvedValue(new Map()),
        getItemNames: vi
          .fn()
          .mockResolvedValue(
            new Map<number, string | undefined>([
              [1, "Gold"],
              [2, "Iron"],
            ])
          ),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(new Map([["10", "Stall One"]])),
        getClaimNameForBuilding: vi.fn().mockResolvedValue("North"),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([offer]),
      },
    };
    const r = await executeQuestBoardShopDetail("g1", "c1", "10", deps);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.content).toContain("**Quest board**");
      expect(r.content).toContain("**North - Stall One**");
      expect(r.content).toContain("Gold ×2");
      expect(r.content).toContain("Iron ×1");
      expect(r.content).toContain("**Stock:** 3");
      expect(r.totalOfferPages).toBe(1);
      expect(r.offerCount).toBe(1);
    }
  });

  it("prefixes SPECIAL badge when offer reward rarity is Legendary", async () => {
    const offer = baseOffer({
      offerStacks: [{ itemId: 1, quantity: 1 }],
      requiredStacks: [],
    });
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi
          .fn()
          .mockResolvedValue(new Map()),
        getItemNames: vi.fn().mockResolvedValue(new Map([[1, "Epic Loot"]])),
        getItemRarityTags: vi
          .fn()
          .mockResolvedValue(new Map([[1, "Legendary"]])),
        getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([offer]),
      },
    };
    const r = await executeQuestBoardShopDetail("g1", "c1", "10", deps);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.content).toContain("**✦ SPECIAL ✦**");
      expect(r.content).toContain("**__Epic Loot ×1__**");
    }
  });

  it("paginates when many offers exceed the text budget", async () => {
    const offers = Array.from({ length: 50 }, (_, i) =>
      baseOffer({
        questKey: `10:${i}`,
        shopEntityIdStr: "10",
        offerSummary: "offer",
        requiredSummary: "req",
        offerStacks: [{ itemId: 1, quantity: 1 }],
        requiredStacks: [{ itemId: 2, quantity: 1 }],
      })
    );
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi.fn().mockResolvedValue([{ buildingId: "10" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi
          .fn()
          .mockResolvedValue(new Map()),
        getItemNames: vi
          .fn()
          .mockResolvedValue(
            new Map<number, string | undefined>([
              [1, "A"],
              [2, "B"],
            ])
          ),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(new Map([["10", "Big Stall"]])),
        getClaimNameForBuilding: vi.fn().mockResolvedValue("Claim"),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue(offers),
      },
    };
    const r0 = await executeQuestBoardShopDetail("g1", "c1", "10", deps, 0);
    expect(r0.kind).toBe("ok");
    if (r0.kind !== "ok") return;
    expect(r0.totalOfferPages).toBeGreaterThan(1);
    expect(r0.offerCount).toBe(50);
    expect(r0.content).toMatch(/_Page \*\*1\*\* of \*\*\d+\*\*_/);
    const r1 = await executeQuestBoardShopDetail("g1", "c1", "10", deps, 1);
    expect(r1.kind).toBe("ok");
    if (r1.kind === "ok") {
      expect(r1.offerPage).toBe(1);
      expect(r1.content).toMatch(/_Page \*\*2\*\* of/);
    }
  });
});
