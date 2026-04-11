import type {
  BuildingDesc,
  BuildingNicknameState,
  BuildingState,
  ClaimState,
  DbConnection,
  InventoryState,
  ItemDesc,
  PlayerUsernameState,
  UserState,
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

/** Subscribes to entity tables and mirrors rows into Postgres (TTL-gated). */
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
  const syncUserState = (row: UserState) => {
    const identityHex = row.identity.toHexString();
    const travelerEntityId = row.entityId.toString();
    void entityCacheRepo
      .upsertUserStateMapping(identityHex, travelerEntityId, ttl)
      .catch((e: unknown) => log.warn("stdb user_state cache upsert failed", e));
  };
  const syncPlayerUsername = (row: PlayerUsernameState) => {
    const id = row.entityId.toString();
    void entityCacheRepo
      .upsertPlayerUsername(id, row.username, ttl)
      .catch((e: unknown) =>
        log.warn("stdb player_username_state cache upsert failed", e)
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

  connection.db.userState.onInsert((_ctx, row) => {
    syncUserState(row);
  });
  connection.db.userState.onUpdate((_ctx, _o, row) => {
    syncUserState(row);
  });
  connection.db.userState.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deleteUserStateMapping(row.identity.toHexString())
      .catch((e: unknown) =>
        log.warn("stdb user_state cache delete failed", e)
      );
  });

  connection.db.playerUsernameState.onInsert((_ctx, row) => {
    syncPlayerUsername(row);
  });
  connection.db.playerUsernameState.onUpdate((_ctx, _o, row) => {
    syncPlayerUsername(row);
  });
  connection.db.playerUsernameState.onDelete((_ctx, row) => {
    void entityCacheRepo
      .deletePlayerUsername(row.entityId.toString())
      .catch((e: unknown) =>
        log.warn("stdb player_username_state cache delete failed", e)
      );
  });

  // One subscription at a time: avoids overlapping BSATN decode + client-cache work from
  // eight simultaneous snapshots. setImmediate defers the next subscribe until after the
  // current SubscribeApplied row callbacks complete.
  const ENTITY_CACHE_QUERIES = [
    "SELECT * FROM item_desc",
    "SELECT * FROM claim_state",
    "SELECT * FROM building_state",
    "SELECT * FROM building_desc",
    "SELECT * FROM building_nickname_state",
    "SELECT * FROM inventory_state",
    "SELECT * FROM user_state",
    "SELECT * FROM player_username_state",
  ] as const;

  let entitySubIndex = 0;
  const subscribeNextEntityTable = (): void => {
    if (entitySubIndex >= ENTITY_CACHE_QUERIES.length) {
      // SpacetimeDB TS SDK runs subscription `onApplied` before per-row onInsert
      // callbacks. Rows are already in the client cache; no full-table iter sync.
      log.info(
        "STDB entity cache subscriptions ready",
        `items=${connection.db.itemDesc.count()} claims=${connection.db.claimState.count()} buildings=${connection.db.buildingState.count()} buildingDescs=${connection.db.buildingDesc.count()} nicknames=${connection.db.buildingNicknameState.count()} inventories=${connection.db.inventoryState.count()} userStates=${connection.db.userState.count()} playerUsernames=${connection.db.playerUsernameState.count()}`
      );
      return;
    }
    const sql = ENTITY_CACHE_QUERIES[entitySubIndex];
    entitySubIndex += 1;
    connection
      .subscriptionBuilder()
      .onApplied(() => {
        setImmediate(subscribeNextEntityTable);
      })
      .subscribe(sql);
  };

  subscribeNextEntityTable();
}
