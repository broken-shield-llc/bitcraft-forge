import {
  aggregateItemTotalsFromInventoryPayload,
  inferBuildingKindFromDescName,
  type BuildingKind,
} from "@forge/domain";
import { count, eq, inArray } from "drizzle-orm";
import type { ForgeDb } from "@forge/db";
import { schema } from "@forge/db";
import type {
  EntityCacheRepository,
  EntityCacheTableCounts,
} from "./entityCacheRepository.js";

function isStale(cachedAt: Date, ttlMs: number): boolean {
  return Date.now() - cachedAt.getTime() >= ttlMs;
}

export class DrizzleEntityCacheRepository implements EntityCacheRepository {
  constructor(private readonly db: ForgeDb) {}

  async upsertItem(
    itemId: number,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({
        cachedAt: schema.stdbItemCache.cachedAt,
      })
      .from(schema.stdbItemCache)
      .where(eq(schema.stdbItemCache.itemId, itemId))
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbItemCache)
      .values({ itemId, payload, cachedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.stdbItemCache.itemId,
        set: {
          payload,
          cachedAt: new Date(),
        },
      });
  }

  async deleteItem(itemId: number): Promise<void> {
    await this.db
      .delete(schema.stdbItemCache)
      .where(eq(schema.stdbItemCache.itemId, itemId));
  }

  async getItemNames(itemIds: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (itemIds.length === 0) return out;
    const uniq = [...new Set(itemIds)];
    const rows = await this.db
      .select({
        itemId: schema.stdbItemCache.itemId,
        payload: schema.stdbItemCache.payload,
      })
      .from(schema.stdbItemCache)
      .where(inArray(schema.stdbItemCache.itemId, uniq));
    for (const r of rows) {
      const name = r.payload.name;
      if (typeof name === "string" && name.trim()) {
        out.set(r.itemId, name.trim());
      }
    }
    return out;
  }

  async getItemRarityTags(itemIds: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (itemIds.length === 0) return out;
    const uniq = [...new Set(itemIds)];
    const rows = await this.db
      .select({
        itemId: schema.stdbItemCache.itemId,
        payload: schema.stdbItemCache.payload,
      })
      .from(schema.stdbItemCache)
      .where(inArray(schema.stdbItemCache.itemId, uniq));
    for (const r of rows) {
      const rarity = (r.payload as Record<string, unknown>).rarity;
      if (rarity && typeof rarity === "object") {
        const tag = (rarity as Record<string, unknown>).tag;
        if (typeof tag === "string" && tag.trim()) out.set(r.itemId, tag.trim());
      }
    }
    return out;
  }

  async upsertClaim(
    claimEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({ cachedAt: schema.stdbClaimCache.cachedAt })
      .from(schema.stdbClaimCache)
      .where(eq(schema.stdbClaimCache.claimEntityId, claimEntityId))
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbClaimCache)
      .values({ claimEntityId, payload, cachedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.stdbClaimCache.claimEntityId,
        set: {
          payload,
          cachedAt: new Date(),
        },
      });
  }

  async deleteClaim(claimEntityId: string): Promise<void> {
    await this.db
      .delete(schema.stdbClaimCache)
      .where(eq(schema.stdbClaimCache.claimEntityId, claimEntityId));
  }

  async getClaimName(claimEntityId: string): Promise<string | undefined> {
    const rows = await this.db
      .select({ payload: schema.stdbClaimCache.payload })
      .from(schema.stdbClaimCache)
      .where(eq(schema.stdbClaimCache.claimEntityId, claimEntityId))
      .limit(1);
    const name = rows[0]?.payload.name;
    return typeof name === "string" && name.trim() ? name.trim() : undefined;
  }

  async getClaimNameForBuilding(
    buildingEntityId: string
  ): Promise<string | undefined> {
    const rows = await this.db
      .select({ payload: schema.stdbBuildingCache.payload })
      .from(schema.stdbBuildingCache)
      .where(eq(schema.stdbBuildingCache.buildingEntityId, buildingEntityId))
      .limit(1);
    const p = rows[0]?.payload as Record<string, unknown> | undefined;
    if (!p) return undefined;
    const raw = p.claimEntityId;
    if (raw === undefined || raw === null) return undefined;
    const claimId = String(raw);
    return this.getClaimName(claimId);
  }

  async upsertBuilding(
    buildingEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({ cachedAt: schema.stdbBuildingCache.cachedAt })
      .from(schema.stdbBuildingCache)
      .where(eq(schema.stdbBuildingCache.buildingEntityId, buildingEntityId))
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbBuildingCache)
      .values({ buildingEntityId, payload, cachedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.stdbBuildingCache.buildingEntityId,
        set: {
          payload,
          cachedAt: new Date(),
        },
      });
  }

  async deleteBuilding(buildingEntityId: string): Promise<void> {
    await this.db
      .delete(schema.stdbBuildingCache)
      .where(eq(schema.stdbBuildingCache.buildingEntityId, buildingEntityId));
  }

  async getBuildingSummary(
    buildingEntityId: string
  ): Promise<string | undefined> {
    const rows = await this.db
      .select({ payload: schema.stdbBuildingCache.payload })
      .from(schema.stdbBuildingCache)
      .where(eq(schema.stdbBuildingCache.buildingEntityId, buildingEntityId))
      .limit(1);
    const p = rows[0]?.payload;
    if (!p) return undefined;
    const claimId = p.claimEntityId;
    const descId = p.buildingDescriptionId;
    const parts: string[] = [];
    if (claimId !== undefined && claimId !== null) {
      parts.push(`claim \`${String(claimId)}\``);
    }
    if (typeof descId === "number") parts.push(`buildingDescId ${descId}`);
    return parts.length ? parts.join(" · ") : undefined;
  }

  async upsertBuildingDesc(
    buildingDescriptionId: number,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({ cachedAt: schema.stdbBuildingDescCache.cachedAt })
      .from(schema.stdbBuildingDescCache)
      .where(
        eq(schema.stdbBuildingDescCache.buildingDescriptionId, buildingDescriptionId)
      )
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbBuildingDescCache)
      .values({
        buildingDescriptionId,
        payload,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.stdbBuildingDescCache.buildingDescriptionId,
        set: {
          payload,
          cachedAt: new Date(),
        },
      });
  }

  async deleteBuildingDesc(buildingDescriptionId: number): Promise<void> {
    await this.db
      .delete(schema.stdbBuildingDescCache)
      .where(
        eq(schema.stdbBuildingDescCache.buildingDescriptionId, buildingDescriptionId)
      );
  }

  async inferBuildingKindFromCachedEntity(
    buildingEntityId: string
  ): Promise<BuildingKind | null> {
    const bRows = await this.db
      .select({ payload: schema.stdbBuildingCache.payload })
      .from(schema.stdbBuildingCache)
      .where(eq(schema.stdbBuildingCache.buildingEntityId, buildingEntityId))
      .limit(1);
    const bp = bRows[0]?.payload as Record<string, unknown> | undefined;
    if (!bp) return null;
    const rawDesc = bp.buildingDescriptionId;
    const descId =
      typeof rawDesc === "number"
        ? rawDesc
        : typeof rawDesc === "string" && rawDesc.trim() !== ""
          ? Number(rawDesc)
          : NaN;
    if (!Number.isFinite(descId)) return null;

    const dRows = await this.db
      .select({ payload: schema.stdbBuildingDescCache.payload })
      .from(schema.stdbBuildingDescCache)
      .where(
        eq(schema.stdbBuildingDescCache.buildingDescriptionId, descId)
      )
      .limit(1);
    const dp = dRows[0]?.payload as Record<string, unknown> | undefined;
    if (!dp) return null;
    const name = dp.name;
    if (typeof name !== "string" || !name.trim()) return null;
    return inferBuildingKindFromDescName(name);
  }

  async upsertBuildingNickname(
    buildingEntityId: string,
    nickname: string,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({ cachedAt: schema.stdbBuildingNicknameCache.cachedAt })
      .from(schema.stdbBuildingNicknameCache)
      .where(eq(schema.stdbBuildingNicknameCache.buildingEntityId, buildingEntityId))
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbBuildingNicknameCache)
      .values({
        buildingEntityId,
        nickname,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.stdbBuildingNicknameCache.buildingEntityId,
        set: {
          nickname,
          cachedAt: new Date(),
        },
      });
  }

  async deleteBuildingNickname(buildingEntityId: string): Promise<void> {
    await this.db
      .delete(schema.stdbBuildingNicknameCache)
      .where(
        eq(schema.stdbBuildingNicknameCache.buildingEntityId, buildingEntityId)
      );
  }

  async getBuildingNickname(
    buildingEntityId: string
  ): Promise<string | undefined> {
    const m = await this.getBuildingNicknames([buildingEntityId]);
    return m.get(buildingEntityId);
  }

  async getBuildingNicknames(
    buildingEntityIds: string[]
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (buildingEntityIds.length === 0) return out;
    const uniq = [...new Set(buildingEntityIds)];
    const rows = await this.db
      .select({
        id: schema.stdbBuildingNicknameCache.buildingEntityId,
        nickname: schema.stdbBuildingNicknameCache.nickname,
      })
      .from(schema.stdbBuildingNicknameCache)
      .where(inArray(schema.stdbBuildingNicknameCache.buildingEntityId, uniq));
    for (const r of rows) {
      const n = r.nickname.trim();
      if (n) out.set(r.id, n);
    }
    return out;
  }

  async upsertInventoryState(
    inventoryEntityId: string,
    ownerEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void> {
    void ttlMs;
    await this.db
      .insert(schema.stdbInventoryCache)
      .values({
        inventoryEntityId,
        ownerEntityId,
        payload,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.stdbInventoryCache.inventoryEntityId,
        set: {
          ownerEntityId,
          payload,
          cachedAt: new Date(),
        },
      });
  }

  async deleteInventoryState(inventoryEntityId: string): Promise<void> {
    await this.db
      .delete(schema.stdbInventoryCache)
      .where(eq(schema.stdbInventoryCache.inventoryEntityId, inventoryEntityId));
  }

  async getInventoryBoardSnapshotForOwners(
    ownerEntityIds: string[]
  ): Promise<Map<string, { hasData: boolean; totals: Map<number, number> }>> {
    const out = new Map<string, { hasData: boolean; totals: Map<number, number> }>();
    const uniq = [...new Set(ownerEntityIds)];
    for (const id of uniq) {
      out.set(id, { hasData: false, totals: new Map() });
    }
    if (uniq.length === 0) return out;

    const rows = await this.db
      .select({
        ownerEntityId: schema.stdbInventoryCache.ownerEntityId,
        payload: schema.stdbInventoryCache.payload,
      })
      .from(schema.stdbInventoryCache)
      .where(inArray(schema.stdbInventoryCache.ownerEntityId, uniq));

    const byOwner = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byOwner.get(r.ownerEntityId) ?? [];
      list.push(r);
      byOwner.set(r.ownerEntityId, list);
    }

    for (const id of uniq) {
      const list = byOwner.get(id);
      if (!list || list.length === 0) continue;
      const totals = new Map<number, number>();
      for (const row of list) {
        const part = aggregateItemTotalsFromInventoryPayload(row.payload);
        for (const [itemId, q] of part) {
          totals.set(itemId, (totals.get(itemId) ?? 0) + q);
        }
      }
      out.set(id, { hasData: true, totals });
    }
    return out;
  }

  async upsertUserStateMapping(
    identityHex: string,
    travelerEntityId: string,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({ cachedAt: schema.stdbUserStateCache.cachedAt })
      .from(schema.stdbUserStateCache)
      .where(eq(schema.stdbUserStateCache.identityHex, identityHex))
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbUserStateCache)
      .values({
        identityHex,
        travelerEntityId,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.stdbUserStateCache.identityHex,
        set: {
          travelerEntityId,
          cachedAt: new Date(),
        },
      });
  }

  async deleteUserStateMapping(identityHex: string): Promise<void> {
    await this.db
      .delete(schema.stdbUserStateCache)
      .where(eq(schema.stdbUserStateCache.identityHex, identityHex));
  }

  async upsertPlayerUsername(
    travelerEntityId: string,
    username: string,
    ttlMs: number
  ): Promise<void> {
    const existing = await this.db
      .select({ cachedAt: schema.stdbPlayerUsernameCache.cachedAt })
      .from(schema.stdbPlayerUsernameCache)
      .where(
        eq(schema.stdbPlayerUsernameCache.travelerEntityId, travelerEntityId)
      )
      .limit(1);
    const row = existing[0];
    if (row && !isStale(row.cachedAt, ttlMs)) return;

    await this.db
      .insert(schema.stdbPlayerUsernameCache)
      .values({
        travelerEntityId,
        username,
        cachedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.stdbPlayerUsernameCache.travelerEntityId,
        set: {
          username,
          cachedAt: new Date(),
        },
      });
  }

  async deletePlayerUsername(travelerEntityId: string): Promise<void> {
    await this.db
      .delete(schema.stdbPlayerUsernameCache)
      .where(
        eq(schema.stdbPlayerUsernameCache.travelerEntityId, travelerEntityId)
      );
  }

  async getTravelerUsernameForIdentity(
    identityHex: string
  ): Promise<string | undefined> {
    const uRows = await this.db
      .select({
        travelerEntityId: schema.stdbUserStateCache.travelerEntityId,
      })
      .from(schema.stdbUserStateCache)
      .where(eq(schema.stdbUserStateCache.identityHex, identityHex))
      .limit(1);
    const tid = uRows[0]?.travelerEntityId;
    if (!tid) return undefined;
    const pRows = await this.db
      .select({ username: schema.stdbPlayerUsernameCache.username })
      .from(schema.stdbPlayerUsernameCache)
      .where(eq(schema.stdbPlayerUsernameCache.travelerEntityId, tid))
      .limit(1);
    const u = pRows[0]?.username?.trim();
    return u || undefined;
  }

  async getEntityCacheTableCounts(): Promise<EntityCacheTableCounts> {
    const countTable = async (
      table:
        | typeof schema.stdbItemCache
        | typeof schema.stdbClaimCache
        | typeof schema.stdbBuildingCache
        | typeof schema.stdbBuildingDescCache
        | typeof schema.stdbBuildingNicknameCache
        | typeof schema.stdbInventoryCache
        | typeof schema.stdbUserStateCache
        | typeof schema.stdbPlayerUsernameCache
    ): Promise<number> => {
      const r = await this.db.select({ c: count() }).from(table);
      return Number(r[0]?.c ?? 0);
    };

    const [
      itemDesc,
      claimState,
      buildingState,
      buildingDesc,
      buildingNickname,
      inventoryState,
      userState,
      playerUsername,
    ] = await Promise.all([
      countTable(schema.stdbItemCache),
      countTable(schema.stdbClaimCache),
      countTable(schema.stdbBuildingCache),
      countTable(schema.stdbBuildingDescCache),
      countTable(schema.stdbBuildingNicknameCache),
      countTable(schema.stdbInventoryCache),
      countTable(schema.stdbUserStateCache),
      countTable(schema.stdbPlayerUsernameCache),
    ]);

    return {
      itemDesc,
      claimState,
      buildingState,
      buildingDesc,
      buildingNickname,
      inventoryState,
      userState,
      playerUsername,
    };
  }
}
