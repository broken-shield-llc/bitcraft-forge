import { describe, expect, it, vi } from "vitest";
import type { ForgeDb } from "@forge/db";
import { DrizzleEntityCacheRepository } from "./drizzleEntityCacheRepository.js";

describe("DrizzleEntityCacheRepository.getEntityCacheTableCounts", () => {
  it("runs eight count queries and maps keys in stable order", async () => {
    const from = vi.fn(() => Promise.resolve([{ c: 11 }]));
    const select = vi.fn(() => ({ from }));
    const mockDb = { select } as unknown as ForgeDb;

    const repo = new DrizzleEntityCacheRepository(mockDb);
    const r = await repo.getEntityCacheTableCounts();

    expect(select).toHaveBeenCalledTimes(8);
    expect(from).toHaveBeenCalledTimes(8);
    expect(r).toEqual({
      itemDesc: 11,
      claimState: 11,
      buildingState: 11,
      buildingDesc: 11,
      buildingNickname: 11,
      inventoryState: 11,
      userState: 11,
      playerUsername: 11,
    });
  });

  it("coerces missing count to zero", async () => {
    const from = vi.fn(() => Promise.resolve([]));
    const select = vi.fn(() => ({ from }));
    const mockDb = { select } as unknown as ForgeDb;

    const repo = new DrizzleEntityCacheRepository(mockDb);
    const r = await repo.getEntityCacheTableCounts();

    expect(r.itemDesc).toBe(0);
    expect(r.playerUsername).toBe(0);
  });
});
