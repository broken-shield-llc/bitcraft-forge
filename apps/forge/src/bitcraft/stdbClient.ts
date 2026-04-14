import { DbConnection } from "@bitcraft/bindings";
import type { ForgeConfig } from "@forge/config";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import type { Client } from "discord.js";
import type { QuestOfferCache } from "./questOfferCache.js";
import { reconnectDelayMs } from "./stdbReconnect.js";
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

/** Bumped before each new `build()` so stale `onConnect` / `onDisconnect` handlers are ignored. */
let connectionEpoch = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
/** Backoff tier for the next scheduled reconnect (reset on successful `onConnect`). */
let reconnectAttempt = 0;
/** True while a handshake is in progress for the latest epoch (blocks overlapping `build()`). */
let stdbConnecting = false;
let activeConnection: DbConnection | undefined;

function clearReconnectTimer(): void {
  if (reconnectTimer !== undefined) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function scheduleReconnect(
  config: ForgeConfig,
  log: Logger,
  deps: StartStdbDeps,
  reason: string
): void {
  clearReconnectTimer();
  const tier = reconnectAttempt;
  const delayMs = reconnectDelayMs(tier);
  reconnectAttempt = Math.min(reconnectAttempt + 1, 24);
  log.warn(
    `SpacetimeDB will reconnect in ${Math.round(delayMs / 1000)}s (backoff tier ${tier})`,
    reason
  );
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    openStdbConnection(config, log, deps);
  }, delayMs);
}

function openStdbConnection(
  config: ForgeConfig,
  log: Logger,
  deps: StartStdbDeps
): void {
  if (stdbConnecting) {
    log.warn("SpacetimeDB connect skipped (already in progress)");
    return;
  }
  stdbConnecting = true;

  try {
    activeConnection?.disconnect();
  } catch {
    // best-effort; replacement socket is opened below
  }

  connectionEpoch += 1;
  const epoch = connectionEpoch;

  const connection = DbConnection.builder()
    .withUri(config.bitcraftWsUri)
    .withModuleName(config.bitcraftModule)
    .onDisconnect(() => {
      if (epoch !== connectionEpoch) return;
      stdbConnecting = false;
      stdbSnapshot.connected = false;
      stdbSnapshot.questProjectionReady = false;
      log.warn("SpacetimeDB disconnected");
      scheduleReconnect(config, log, deps, "disconnect");
    })
    .onConnectError((_ctx, err) => {
      if (epoch !== connectionEpoch) return;
      stdbConnecting = false;
      const msg = connectErrorMessage(err);
      const stored =
        msg.length > MAX_LAST_ERROR_LEN
          ? `${msg.slice(0, MAX_LAST_ERROR_LEN)}…`
          : msg;
      log.error("SpacetimeDB onConnectError", stored);
      scheduleReconnect(config, log, deps, stored);
    })
    .onConnect((conn, identity) => {
      if (epoch !== connectionEpoch) return;
      stdbConnecting = false;
      clearReconnectTimer();
      reconnectAttempt = 0;
      stdbSnapshot.connected = true;
      stdbSnapshot.questProjectionReady = false;
      log.info("SpacetimeDB connected", identity.toHexString());

      deps.questCache.clear();

      wireQuestSubscriptions(conn, {
        config,
        log,
        repo: deps.repo,
        entityCacheRepo: deps.entityCacheRepo,
        getDiscordClient: deps.getDiscordClient,
        questCache: deps.questCache,
        onQuestProjectionReady: () => {
          if (epoch !== connectionEpoch) return;
          stdbSnapshot.questProjectionReady = true;
          let tradeOrderRows = 0;
          try {
            tradeOrderRows = conn.db.tradeOrderState.count();
          } catch {
            void 0;
          }
          log.info(
            "Quest projection subscriptions applied",
            `trade_order_state rows=${tradeOrderRows} quest_projection_ready=true`
          );
          // After traveler + trade_order_state snapshots, start entity tables one-by-one
          // so we never overlap that heavy load with eight parallel cache subscriptions.
          wireStdbEntityCache(conn, {
            config,
            log,
            entityCacheRepo: deps.entityCacheRepo,
          });
        },
      });
    })
    .withToken(config.bitcraftJwt)
    .build();

  activeConnection = connection;
}

/**
 * Starts a read-only SpacetimeDB client (BitCraft regional module).
 * Uses pre-generated BitCraft bindings + @clockworklabs/spacetimedb-sdk (see README).
 * Reconnects after maintenance or network loss with exponential backoff and jitter.
 */
export function startStdb(
  config: ForgeConfig,
  log: Logger,
  deps: StartStdbDeps
): void {
  clearReconnectTimer();
  openStdbConnection(config, log, deps);
}
