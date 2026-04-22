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
      expect(r.requireQuery).toBeNull();
    }
  });

  it("filters shops by required item name (case-insensitive)", async () => {
    const a = baseOffer({
      questKey: "10:1",
      shopEntityIdStr: "10",
      offerStacks: [{ itemId: 1, quantity: 1 }],
      requiredStacks: [{ itemId: 5, quantity: 1 }],
    });
    const b = baseOffer({
      questKey: "11:1",
      shopEntityIdStr: "11",
      offerStacks: [{ itemId: 1, quantity: 1 }],
      requiredStacks: [{ itemId: 6, quantity: 1 }],
    });
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi
          .fn()
          .mockResolvedValue([{ buildingId: "10" }, { buildingId: "11" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi
          .fn()
          .mockResolvedValue(new Map()),
        getItemNames: vi.fn().mockResolvedValue(
          new Map<number, string | undefined>([
            [1, "Coin"],
            [5, "Gold Ingot"],
            [6, "Stone"],
          ])
        ),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(
            new Map([
              ["10", "A"],
              ["11", "B"],
            ])
          ),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([a, b]),
      },
    };
    const r = await executeQuestBoardList("g1", "c1", deps, 0, "InGoT");
    expect(r.kind).toBe("list");
    if (r.kind === "list") {
      expect(r.shops).toHaveLength(1);
      expect(r.shops[0]?.shopEntityIdStr).toBe("10");
      expect(r.requireQuery).toBe("ingot");
      expect(r.content).toContain("search: **ingot**");
      expect(r.content).toContain("Query: **ingot**");
    }
  });

  it("treats whitespace-only requireQuery as no search filter", async () => {
    const a = baseOffer({ questKey: "10:1", shopEntityIdStr: "10" });
    const b = baseOffer({ questKey: "11:1", shopEntityIdStr: "11" });
    const deps: QuestBoardDeps = {
      repo: {
        listBuildings: vi
          .fn()
          .mockResolvedValue([{ buildingId: "10" }, { buildingId: "11" }]),
      },
      entityCacheRepo: {
        getInventoryBoardSnapshotForOwners: vi
          .fn()
          .mockResolvedValue(new Map()),
        getItemNames: vi.fn().mockResolvedValue(new Map()),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(
            new Map([
              ["10", "A"],
              ["11", "B"],
            ])
          ),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([a, b]),
      },
    };
    const r = await executeQuestBoardList("g1", "c1", deps, 0, "  \t");
    expect(r.kind).toBe("list");
    if (r.kind === "list") {
      expect(r.shops).toHaveLength(2);
      expect(r.requireQuery).toBeNull();
    }
  });

  it("returns no-match message when the query matches no required item names", async () => {
    const a = baseOffer({
      questKey: "10:1",
      requiredStacks: [{ itemId: 5, quantity: 1 }],
      offerStacks: [{ itemId: 1, quantity: 1 }],
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
            new Map<number, string | undefined>([[5, "OnlyWood"]])
          ),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi.fn().mockResolvedValue(new Map()),
        getClaimNameForBuilding: vi.fn().mockResolvedValue(undefined),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi.fn().mockReturnValue([a]),
      },
    };
    const r = await executeQuestBoardList("g1", "c1", deps, 0, "ingot");
    expect(r.kind).toBe("no_offers");
    if (r.kind === "no_offers") {
      expect(r.content).toContain("ingot");
      expect(r.content).toContain("No offers require items matching");
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

  it("with requireQuery, only lists offers whose required item names match", async () => {
    const needIron = baseOffer({
      questKey: "10:1",
      offerStacks: [{ itemId: 1, quantity: 1 }],
      requiredStacks: [{ itemId: 2, quantity: 1 }],
    });
    const needGold = baseOffer({
      questKey: "10:2",
      offerStacks: [{ itemId: 1, quantity: 1 }],
      requiredStacks: [{ itemId: 3, quantity: 1 }],
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
              [1, "A"],
              [2, "Iron Bar"],
              [3, "Gold Coin"],
            ])
          ),
        getItemRarityTags: vi.fn().mockResolvedValue(new Map()),
        getBuildingNicknames: vi
          .fn()
          .mockResolvedValue(new Map([["10", "Stall"]])),
        getClaimNameForBuilding: vi.fn().mockResolvedValue("C"),
      },
      questOffers: {
        snapshotForMonitoredBuildings: vi
          .fn()
          .mockReturnValue([needIron, needGold]),
      },
    };
    const r = await executeQuestBoardShopDetail("g1", "c1", "10", deps, 0, "GOLD");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.content).toContain("search: **gold**");
      expect(r.content).toContain("Gold Coin");
      expect(r.content).not.toContain("Iron Bar");
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
