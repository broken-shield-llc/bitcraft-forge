import type { BuildingKind } from "@forge/domain";

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
  /** Resolved item display names for ids present in the cache (batch). */
  getItemNames(itemIds: number[]): Promise<Map<number, string>>;
  /** `ItemDesc.rarity.tag` (e.g. "Legendary") when cached (batch). */
  getItemRarityTags(itemIds: number[]): Promise<Map<number, string>>;

  upsertClaim(
    claimEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteClaim(claimEntityId: string): Promise<void>;
  /** Claim display name when cached. */
  getClaimName(claimEntityId: string): Promise<string | undefined>;
  /** Claim display name for the building's claim (via `building_state.claimEntityId`). */
  getClaimNameForBuilding(
    buildingEntityId: string
  ): Promise<string | undefined>;

  upsertBuilding(
    buildingEntityId: string,
    payload: Record<string, unknown>,
    ttlMs: number
  ): Promise<void>;
  deleteBuilding(buildingEntityId: string): Promise<void>;
  /** Short summary when cached (claim id, description id). */
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
  /**
   * Per shop (`ownerEntityId`): whether any `inventory_state` row is cached,
   * and aggregated item quantities across all inventory rows for that owner.
   */
  getInventoryBoardSnapshotForOwners(
    ownerEntityIds: string[]
  ): Promise<Map<string, { hasData: boolean; totals: Map<number, number> }>>;
}
