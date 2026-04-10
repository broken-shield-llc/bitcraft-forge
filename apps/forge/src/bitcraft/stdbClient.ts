import { DbConnection } from "@bitcraft/bindings";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import type { Client } from "discord.js";
import { appendPocEvent } from "./pocEventLog.js";
import type { QuestOfferCache } from "./questOfferCache.js";
import { wireStdbEntityCache } from "./wireStdbEntityCache.js";
import { wireQuestSubscriptions } from "./wireQuestSubscriptions.js";

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

const MAX_LAST_ERROR_LEN = 400;

export type StdbConnectionSnapshot = {
  connected: boolean;
  questProjectionReady: boolean;
};

const stdbSnapshot: StdbConnectionSnapshot = {
  connected: false,
  questProjectionReady: false,
};

export function getStdbConnectionSnapshot(): StdbConnectionSnapshot {
  return { ...stdbSnapshot };
}

export type StartStdbDeps = {
  repo: GuildConfigRepository;
  entityCacheRepo: EntityCacheRepository;
  getDiscordClient: () => Client | undefined;
  questCache: QuestOfferCache;
};

/**
 * Starts a read-only SpacetimeDB client (BitCraft regional module).
 * Uses pre-generated BitCraft bindings + @clockworklabs/spacetimedb-sdk (see README).
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
      stdbSnapshot.connected = false;
      stdbSnapshot.questProjectionReady = false;
      log.warn("SpacetimeDB disconnected");
    })
    .onConnectError((_ctx, err) => {
      const msg = connectErrorMessage(err);
      const stored =
        msg.length > MAX_LAST_ERROR_LEN
          ? `${msg.slice(0, MAX_LAST_ERROR_LEN)}…`
          : msg;
      log.error("SpacetimeDB onConnectError", stored);
    })
    .onConnect((connection, identity) => {
      stdbSnapshot.connected = true;
      stdbSnapshot.questProjectionReady = false;
      log.info("SpacetimeDB connected", identity.toHexString());

      wireQuestSubscriptions(connection, {
        config,
        log,
        repo: deps.repo,
        entityCacheRepo: deps.entityCacheRepo,
        getDiscordClient: deps.getDiscordClient,
        questCache: deps.questCache,
        onQuestProjectionReady: () => {
          stdbSnapshot.questProjectionReady = true;
          let tradeOrderRows = 0;
          try {
            tradeOrderRows = connection.db.tradeOrderState.count();
          } catch {
            void 0;
          }
          appendPocEvent(config.pocEventLogPath, {
            kind: "subscription_applied",
            table: "trade_order_state",
            count: tradeOrderRows,
          });
          log.info(
            "Quest projection subscriptions applied",
            `trade_order_state rows: ${tradeOrderRows}`
          );
        },
      });

      wireStdbEntityCache(connection, {
        config,
        log,
        entityCacheRepo: deps.entityCacheRepo,
      });
    })
    .withToken(config.bitcraftJwt)
    .build();
}
