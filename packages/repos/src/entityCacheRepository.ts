import type { BuildingKind } from "@forge/domain";

export type EntityCacheTableCounts = {
  itemDesc: number;
  claimState: number;
  buildingState: number;
  buildingDesc: number;
  buildingNickname: number;
  inventoryState: number;
  userState: number;
  playerUsername: number;
};

/**
 * Persists first-seen SpacetimeDB entity snapshots (`item_desc`, `claim_state`, `building_state`,
 * `building_desc`, …) with TTL-gated refresh (see `FORGE_STDB_CACHE_TTL_MS`).
 */
export interface EntityCacheRepository {
  upsertItem(
    itemId: number,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteItem(itemId: number): Promise<void>;
  getItemNames(itemIds: number[]): Promise<Map<number, string>>;
  getItemRarityTags(itemIds: number[]): Promise<Map<number, string>>;
  /** `ItemDesc.tier` from cached payload; omitted ids have no cache row yet. */
  getItemCraftingTiers(itemIds: number[]): Promise<Map<number, number | null>>;

  upsertClaim(
    claimEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteClaim(claimEntityId: string): Promise<void>;
  getClaimName(claimEntityId: string): Promise<string | undefined>;
  getClaimNameForBuilding(
    buildingEntityId: string
  ): Promise<string | undefined>;

  upsertBuilding(
    buildingEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteBuilding(buildingEntityId: string): Promise<void>;
  getBuildingSummary(buildingEntityId: string): Promise<string | undefined>;

  upsertBuildingDesc(
    buildingDescriptionId: number,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteBuildingDesc(buildingDescriptionId: number): Promise<void>;
  /**
   * Resolves stall vs counter from cached `building_state` + `building_desc` payloads.
   * Null if either row is missing or the description name does not match a barter type.
   */
  inferBuildingKindFromCachedEntity(
    buildingEntityId: string
  ): Promise<BuildingKind | null>;

  upsertBuildingNickname(
    buildingEntityId: string,
    nickname: string,
    ttlMs: number
  ): Promise<void>;
  deleteBuildingNickname(buildingEntityId: string): Promise<void>;
  getBuildingNickname(
    buildingEntityId: string
  ): Promise<string | undefined>;
  getBuildingNicknames(
    buildingEntityIds: string[]
  ): Promise<Map<string, string>>;

  upsertInventoryState(
    inventoryEntityId: string,
    ownerEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteInventoryState(inventoryEntityId: string): Promise<void>;
  /** Per-shop inventory cache: presence flag + aggregated item quantities. */
  getInventoryBoardSnapshotForOwners(
    ownerEntityIds: string[]
  ): Promise<Map<string, { hasData: boolean; totals: Map<number, number> }>>;

  upsertUserStateMapping(
    identityHex: string,
    travelerEntityId: string,
    ttlMs: number
  ): Promise<void>;
  deleteUserStateMapping(identityHex: string): Promise<void>;

  upsertPlayerUsername(
    travelerEntityId: string,
    username: string,
    ttlMs: number
  ): Promise<void>;
  deletePlayerUsername(travelerEntityId: string): Promise<void>;

  getTravelerUsernameForIdentity(
    identityHex: string
  ): Promise<string | undefined>;

  getEntityCacheTableCounts(): Promise<EntityCacheTableCounts>;
}
