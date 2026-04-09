import { DbConnection } from "@bitcraft/bindings";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import type { Client } from "discord.js";
import { appendPocEvent } from "./pocEventLog.js";
import type { QuestOfferCache } from "./questOfferCache.js";
import { wireStdbEntityCache } from "./wireStdbEntityCache.js";
import { wireQuestSubscriptions } from "./wireQuestSubscriptions.js";

export type StdbHealth = {
  connected: boolean;
  identityHex: string | null;
  subscriptionApplied: boolean;
  regionConnectionInfoCount: number;
  tradeOrderRowCount: number;
  travelerTradeDescRowCount: number;
  lastError: string | null;
};

const health: StdbHealth = {
  connected: false,
  identityHex: null,
  subscriptionApplied: false,
  regionConnectionInfoCount: 0,
  tradeOrderRowCount: 0,
  travelerTradeDescRowCount: 0,
  lastError: null,
};

let activeConnection: DbConnection | null = null;

/**
 * SpacetimeDB often passes a WebSocket `CloseEvent` (not `Error`), so `message` is empty.
 * Surface `code` / `reason` / `wasClean` for diagnostics.
 */
function connectErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();

  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    const looksLikeClose =
      o.type === "close" ||
      typeof o.code === "number" ||
      typeof o.reason === "string";
    if (looksLikeClose) {
      const code = o.code;
      const reason =
        typeof o.reason === "string" && o.reason.trim()
          ? o.reason.trim()
          : "";
      const wasClean = o.wasClean;
      const parts: string[] = ["WebSocket close"];
      if (typeof code === "number") parts.push(`code=${code}`);
      if (reason) parts.push(`reason=${JSON.stringify(reason)}`);
      if (typeof wasClean === "boolean") parts.push(`wasClean=${wasClean}`);
      let s = parts.join(" ");
      if (s === "WebSocket close") {
        s +=
          " (no code/reason — often wrong WS URL, TLS, module name, or auth; see BitCraft STDB docs)";
      }
      return s;
    }
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Keep Discord `/forge health` readable (full message still in logs). */
const MAX_LAST_ERROR_LEN = 400;

export function getStdbHealth(): StdbHealth {
  return { ...health };
}

function refreshRowCount(conn: DbConnection): void {
  try {
    health.regionConnectionInfoCount = conn.db.regionConnectionInfo.count();
    health.tradeOrderRowCount = conn.db.tradeOrderState.count();
    health.travelerTradeDescRowCount = conn.db.travelerTradeOrderDesc.count();
  } catch {
    /* ignore */
  }
}

export type StartStdbDeps = {
  repo: GuildConfigRepository;
  entityCacheRepo: EntityCacheRepository;
  getDiscordClient: () => Client | undefined;
  questCache: QuestOfferCache;
};

/**
 * Starts a read-only SpacetimeDB client (BitCraft regional module).
 * Uses pre-generated BitCraft bindings + @clockworklabs/spacetimedb-sdk (see docs/FORGE_PLAN.md).
 */
export function startStdb(
  config: ForgeConfig,
  log: Logger,
  deps: StartStdbDeps
): void {
  DbConnection.builder()
    .withUri(config.bitcraftWsUri)
    .withModuleName(config.bitcraftModule)
    .onDisconnect(() => {
      health.connected = false;
      activeConnection = null;
      health.lastError = "disconnected";
      log.warn("SpacetimeDB disconnected");
    })
    .onConnectError((_ctx, err) => {
      const msg = connectErrorMessage(err);
      const stored =
        msg.length > MAX_LAST_ERROR_LEN
          ? `${msg.slice(0, MAX_LAST_ERROR_LEN)}…`
          : msg;
      health.lastError = `onConnectError: ${stored}`;
      log.error("SpacetimeDB onConnectError", msg);
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

      wireQuestSubscriptions(connection, {
        config,
        log,
        repo: deps.repo,
        entityCacheRepo: deps.entityCacheRepo,
        getDiscordClient: deps.getDiscordClient,
        questCache: deps.questCache,
      });

      wireStdbEntityCache(connection, {
        config,
        log,
        entityCacheRepo: deps.entityCacheRepo,
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
