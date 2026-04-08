import { DbConnection } from "@bitcraft/bindings";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import { appendPocEvent } from "./pocEventLog.js";

export type StdbHealth = {
  connected: boolean;
  identityHex: string | null;
  subscriptionApplied: boolean;
  regionConnectionInfoCount: number;
  lastError: string | null;
};

const health: StdbHealth = {
  connected: false,
  identityHex: null,
  subscriptionApplied: false,
  regionConnectionInfoCount: 0,
  lastError: null,
};

let activeConnection: DbConnection | null = null;

export function getStdbHealth(): StdbHealth {
  return { ...health };
}

function refreshRowCount(conn: DbConnection): void {
  try {
    health.regionConnectionInfoCount = conn.db.regionConnectionInfo.count();
  } catch {
    /* ignore */
  }
}

/**
 * Starts a read-only SpacetimeDB client (BitCraft regional module).
 * Uses pre-generated BitCraft bindings + @clockworklabs/spacetimedb-sdk (see docs/FORGE_PLAN.md).
 */
export function startStdb(config: ForgeConfig, log: Logger): void {
  DbConnection.builder()
    .withUri(config.bitcraftWsUri)
    .withModuleName(config.bitcraftModule)
    .onDisconnect(() => {
      health.connected = false;
      activeConnection = null;
      log.warn("SpacetimeDB disconnected");
    })
    .onConnectError(() => {
      health.lastError = "onConnectError";
      log.error("SpacetimeDB onConnectError");
    })
    .onConnect((connection, identity) => {
      activeConnection = connection;
      health.connected = true;
      health.identityHex = identity.toHexString();
      health.lastError = null;
      log.info("SpacetimeDB connected", health.identityHex);

      connection.db.regionConnectionInfo.onInsert((_ctx, row) => {
        refreshRowCount(connection);
        appendPocEvent(config.pocEventLogPath, {
          kind: "region_connection_info_insert",
          id: row.id,
        });
        log.debug("region_connection_info insert", row.id);
      });

      connection
        .subscriptionBuilder()
        .onApplied(() => {
          health.subscriptionApplied = true;
          refreshRowCount(connection);
          appendPocEvent(config.pocEventLogPath, {
            kind: "subscription_applied",
            table: "region_connection_info",
            count: health.regionConnectionInfoCount,
          });
          log.info(
            "Subscription applied",
            `region_connection_info rows: ${health.regionConnectionInfoCount}`
          );
        })
        .subscribe("SELECT * FROM region_connection_info");
    })
    .withToken(config.bitcraftJwt)
    .build();

  setInterval(() => {
    const c = activeConnection;
    if (!c || !health.connected) return;
    refreshRowCount(c);
  }, 30_000);
}
