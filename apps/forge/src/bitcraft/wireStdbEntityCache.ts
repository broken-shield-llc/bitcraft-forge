import type {
  BuildingDesc,
  BuildingNicknameState,
  BuildingState,
  ClaimState,
  DbConnection,
  InventoryState,
  ItemDesc,
} from "@bitcraft/bindings";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository } from "@forge/repos";
import { stdbRowToJson } from "./stdbRowJson.js";

export type WireEntityCacheDeps = {
  config: ForgeConfig;
  log: Logger;
  entityCacheRepo: EntityCacheRepository;
};

/**
 * Subscribes to `item_desc`, `claim_state`, `building_state`, `building_desc`,
 * `building_nickname_state`, and `inventory_state`; mirrors rows into Postgres (TTL-gated where noted in repo).
 */
export function wireStdbEntityCache(
  connection: DbConnection,
  deps: WireEntityCacheDeps
): void {
  const { config, log, entityCacheRepo } = deps;
  const ttl = config.stdbCacheTtlMs;

  const syncItem = (row: ItemDesc) => {
    void entityCacheRepo
      .upsertItem(row.id, stdbRowToJson(row), ttl)
      .catch((e: unknown) => log.warn("stdb item cache upsert failed", e));
  };
  const syncClaim = (row: ClaimState) => {
    const id = row.entityId.toString();
    void entityCacheRepo
      .upsertClaim(id, stdbRowToJson(row), ttl)
      .catch((e: unknown) => log.warn("stdb claim cache upsert failed", e));
  };
  const syncBuilding = (row: BuildingState) => {
    const id = row.entityId.toString();
    void entityCacheRepo
      .upsertBuilding(id, stdbRowToJson(row), ttl)
      .catch((e: unknown) => log.warn("stdb building cache upsert failed", e));
  };
  const syncBuildingDesc = (row: BuildingDesc) => {
    void entityCacheRepo
      .upsertBuildingDesc(row.id, stdbRowToJson(row), ttl)
      .catch((e: unknown) =>
        log.warn("stdb building_desc cache upsert failed", e)
      );
  };
  const syncBuildingNickname = (row: BuildingNicknameState) => {
    const id = row.entityId.toString();
    void entityCacheRepo
      .upsertBuildingNickname(id, row.nickname, ttl)
      .catch((e: unknown) =>
        log.warn("stdb building nickname cache upsert failed", e)
      );
  };
  const syncInventory = (row: InventoryState) => {
    const id = row.entityId.toString();
    const owner = row.ownerEntityId.toString();
    void entityCacheRepo
      .upsertInventoryState(id, owner, stdbRowToJson(row), ttl)
      .catch((e: unknown) =>
        log.warn("stdb inventory cache upsert failed", e)
      );
  };

  connection.db.itemDesc.onInsert((_ctx, row) => {
    syncItem(row);
  });
  connection.db.itemDesc.onUpdate((_ctx, _o, row) => {
    syncItem(row);
  });
  connection.db.itemDesc.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteItem(row.id)
      .catch((e: unknown) => log.warn("stdb item cache delete failed", e));
  });

  connection.db.claimState.onInsert((_ctx, row) => {
    syncClaim(row);
  });
  connection.db.claimState.onUpdate((_ctx, _o, row) => {
    syncClaim(row);
  });
  connection.db.claimState.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteClaim(row.entityId.toString())
      .catch((e: unknown) => log.warn("stdb claim cache delete failed", e));
  });

  connection.db.buildingState.onInsert((_ctx, row) => {
    syncBuilding(row);
  });
  connection.db.buildingState.onUpdate((_ctx, _o, row) => {
    syncBuilding(row);
  });
  connection.db.buildingState.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteBuilding(row.entityId.toString())
      .catch((e: unknown) => log.warn("stdb building cache delete failed", e));
  });

  connection.db.buildingDesc.onInsert((_ctx, row) => {
    syncBuildingDesc(row);
  });
  connection.db.buildingDesc.onUpdate((_ctx, _o, row) => {
    syncBuildingDesc(row);
  });
  connection.db.buildingDesc.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteBuildingDesc(row.id)
      .catch((e: unknown) =>
        log.warn("stdb building_desc cache delete failed", e)
      );
  });

  connection.db.buildingNicknameState.onInsert((_ctx, row) => {
    syncBuildingNickname(row);
  });
  connection.db.buildingNicknameState.onUpdate((_ctx, _o, row) => {
    syncBuildingNickname(row);
  });
  connection.db.buildingNicknameState.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteBuildingNickname(row.entityId.toString())
      .catch((e: unknown) =>
        log.warn("stdb building nickname cache delete failed", e)
      );
  });

  connection.db.inventoryState.onInsert((_ctx, row) => {
    syncInventory(row);
  });
  connection.db.inventoryState.onUpdate((_ctx, _o, row) => {
    syncInventory(row);
  });
  connection.db.inventoryState.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteInventoryState(row.entityId.toString())
      .catch((e: unknown) =>
        log.warn("stdb inventory cache delete failed", e)
      );
  });

  let subsReady = 0;
  const onSubApplied = (): void => {
    subsReady += 1;
    if (subsReady < 6) return;
    try {
      for (const row of connection.db.itemDesc.iter()) syncItem(row);
      for (const row of connection.db.claimState.iter()) syncClaim(row);
      for (const row of connection.db.buildingState.iter()) syncBuilding(row);
      for (const row of connection.db.buildingDesc.iter()) syncBuildingDesc(row);
      for (const row of connection.db.buildingNicknameState.iter())
        syncBuildingNickname(row);
      for (const row of connection.db.inventoryState.iter()) syncInventory(row);
    } catch (e: unknown) {
      log.warn("stdb entity cache initial iter failed", e);
    }
    log.info(
      "STDB entity cache subscriptions ready",
      `items=${connection.db.itemDesc.count()} claims=${connection.db.claimState.count()} buildings=${connection.db.buildingState.count()} buildingDescs=${connection.db.buildingDesc.count()} nicknames=${connection.db.buildingNicknameState.count()} inventories=${connection.db.inventoryState.count()}`
    );
  };

  connection
    .subscriptionBuilder()
    .onApplied(onSubApplied)
    .subscribe("SELECT * FROM item_desc");

  connection
    .subscriptionBuilder()
    .onApplied(onSubApplied)
    .subscribe("SELECT * FROM claim_state");

  connection
    .subscriptionBuilder()
    .onApplied(onSubApplied)
    .subscribe("SELECT * FROM building_state");

  connection
    .subscriptionBuilder()
    .onApplied(onSubApplied)
    .subscribe("SELECT * FROM building_desc");

  connection
    .subscriptionBuilder()
    .onApplied(onSubApplied)
    .subscribe("SELECT * FROM building_nickname_state");

  connection
    .subscriptionBuilder()
    .onApplied(onSubApplied)
    .subscribe("SELECT * FROM inventory_state");
}
