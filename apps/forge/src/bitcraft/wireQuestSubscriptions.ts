import type {
  DbConnection,
  TradeOrderState,
  TravelerTradeOrderDesc,
} from "@bitcraft/bindings";
import type { ForgeConfig } from "@forge/config";
import {
  buildQuestOfferEmbed,
  createKeyedDebouncer,
} from "@forge/discord-forge";
import { formatItemStacksWithNames } from "@forge/domain";
import type { Logger } from "@forge/logger";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";
import { ChannelType, type Client } from "discord.js";
import { mapTradeOrderToSnapshot } from "./mapTradeOrderState.js";
import type { QuestOfferCache } from "./questOfferCache.js";

export type WireQuestDeps = {
  config: ForgeConfig;
  log: Logger;
  repo: GuildConfigRepository;
  entityCacheRepo: EntityCacheRepository;
  getDiscordClient: () => Client | undefined;
  questCache: QuestOfferCache;
};

type ScopeRef = { discordGuildId: string; forgeChannelId: string };

function scopeKey(r: ScopeRef): string {
  return `${r.discordGuildId}\x1f${r.forgeChannelId}`;
}

function parseScopeKey(k: string): ScopeRef {
  const i = k.indexOf("\x1f");
  return {
    discordGuildId: k.slice(0, i),
    forgeChannelId: k.slice(i + 1),
  };
}

/** shop entity id → scope keys (`guildId` + unit separator + `forgeChannelId`) */
function buildShopToScopes(
  pairs: Awaited<
    ReturnType<GuildConfigRepository["listMonitoredBuildingScopePairs"]>
  >
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const { discordGuildId, forgeChannelId, buildingId } of pairs) {
    const sk = scopeKey({ discordGuildId, forgeChannelId });
    const set = m.get(buildingId) ?? new Set<string>();
    set.add(sk);
    m.set(buildingId, set);
  }
  return m;
}

/**
 * Subscribes to traveler trade descriptors + trade order state; keeps cache + debounced Discord announcements.
 */
export function wireQuestSubscriptions(
  connection: DbConnection,
  deps: WireQuestDeps
): void {
  const { config, log, repo, entityCacheRepo, getDiscordClient, questCache } =
    deps;
  const travelerDescById = new Map<number, TravelerTradeOrderDesc>();
  let shopToScopes = new Map<string, Set<string>>();
  let subscriptionsReady = 0;
  let dataReady = false;
  /** Quest keys present in the initial `trade_order_state` snapshot (replay inserts match these). */
  const keysFromHydration = new Set<string>();
  /** Keys removed by a live `onDelete` before the matching `onInsert` (delete+reinsert updates). */
  const deletedQuestKeys = new Set<string>();
  /**
   * When save replaces an order, the client may **insert** the new row before **deleting** the old one
   * (different `entityId` → different quest keys). We record the last delete per shop to classify
   * the insert as UPDATE instead of NEW.
   */
  const lastDeleteByShop = new Map<string, { questKey: string; at: number }>();
  /** Max gap (ms) when delete happens *after* insert (new row first, then old row removed). */
  const replaceAfterDeleteMs = 2000;
  /** Max gap (ms) when delete happens *before* insert (old row removed, then new row). */
  const replaceBeforeDeleteMs = 150;
  /** Delay before announcing NEW so a trailing `onDelete` can be observed (insert-before-delete). */
  const newAnnounceDeferMs = 800;
  /** Monotonic gate: no Discord announces until after subscription hydration + grace. */
  let announceNotBefore = 0;

  const debouncer = createKeyedDebouncer(config.announcementDebounceMs);

  const refreshShopIndex = async (): Promise<void> => {
    try {
      const pairs = await repo.listMonitoredBuildingScopePairs();
      shopToScopes = buildShopToScopes(pairs);
    } catch (e: unknown) {
      log.warn("failed to refresh monitored shop index", e);
    }
  };

  void refreshShopIndex();
  setInterval(() => {
    void refreshShopIndex();
  }, 45_000);

  const announceToScope = async (
    scopeSk: string,
    row: TradeOrderState,
    kind: "new" | "update"
  ): Promise<void> => {
    const { discordGuildId, forgeChannelId } = parseScopeKey(scopeSk);
    const channelId = await repo.getAnnouncementChannel(
      discordGuildId,
      forgeChannelId
    );
    if (!channelId) {
      log.debug(
        "quest announce skipped (no channel)",
        `guild=${discordGuildId}`,
        `forgeCh=${forgeChannelId}`
      );
      return;
    }
    const client = getDiscordClient();
    if (!client) {
      log.debug("quest announce skipped (no discord client)");
      return;
    }
    const snap = mapTradeOrderToSnapshot(row);
    let shopNickname: string | undefined;
    let claimName: string | undefined;
    let offerSummary = snap.offerSummary;
    let requiredSummary = snap.requiredSummary;
    try {
      shopNickname = await entityCacheRepo.getBuildingNickname(
        snap.shopEntityIdStr
      );
    } catch (e: unknown) {
      log.warn("building nickname lookup for announcement failed", e);
    }
    try {
      claimName = await entityCacheRepo.getClaimNameForBuilding(
        snap.shopEntityIdStr
      );
    } catch (e: unknown) {
      log.warn("claim name lookup for announcement failed", e);
    }
    try {
      const ids = new Set<number>();
      for (const s of snap.offerStacks ?? []) ids.add(s.itemId);
      for (const s of snap.requiredStacks ?? []) ids.add(s.itemId);
      const itemNames = await entityCacheRepo.getItemNames([...ids]);
      if ((snap.offerStacks?.length ?? 0) > 0) {
        offerSummary = formatItemStacksWithNames(snap.offerStacks ?? [], itemNames);
      }
      if ((snap.requiredStacks?.length ?? 0) > 0) {
        requiredSummary = formatItemStacksWithNames(
          snap.requiredStacks ?? [],
          itemNames
        );
      }
    } catch (e: unknown) {
      log.warn("item name lookup for announcement failed", e);
    }
    try {
      log.debug(
        "quest announce send",
        `guild=${discordGuildId}`,
        `forgeCh=${forgeChannelId}`,
        `channel=${channelId}`,
        `kind=${kind}`,
        `quest=${snap.questKey}`
      );
      const ch = await client.channels.fetch(channelId);
      if (
        !ch ||
        (ch.type !== ChannelType.GuildText &&
          ch.type !== ChannelType.GuildAnnouncement)
      ) {
        log.debug(
          "quest announce skipped (channel wrong type or missing)",
          `guild=${discordGuildId}`,
          `forgeCh=${forgeChannelId}`,
          `channel=${channelId}`
        );
        return;
      }
      await ch.send({
        embeds: [
          buildQuestOfferEmbed(snap, {
            kind,
            claimName,
            shopNickname,
            offerSummary,
            requiredSummary,
          }),
        ],
      });
    } catch (e: unknown) {
      // Discord error codes we see here when the stored channel is no longer usable:
      // - 50001 Missing Access (bot removed / perms revoked / channel private)
      // - 10003 Unknown Channel (deleted)
      // - 50013 Missing Permissions (bot can see channel but can't post/fetch)
      const code = (e as { code?: unknown } | null)?.code;
      if (code === 50001 || code === 10003 || code === 50013) {
        log.warn(
          "quest announcement disabled (channel inaccessible)",
          `guild=${discordGuildId}`,
          `forgeCh=${forgeChannelId}`,
          `channel=${channelId}`,
          `code=${String(code)}`
        );
        try {
          await repo.setAnnouncementChannel(
            discordGuildId,
            forgeChannelId,
            null
          );
        } catch (e2: unknown) {
          log.warn("failed to clear announcement channel after discord error", e2);
        }
        return;
      }
      log.warn("quest announcement failed", e);
    }
  };

  const canAnnounceLive = (): boolean =>
    dataReady && Date.now() >= announceNotBefore;

  const dispatchQuestAnnounce = (
    row: TradeOrderState,
    kind: "new" | "update"
  ): void => {
    const snap = mapTradeOrderToSnapshot(row);
    const shopId = snap.shopEntityIdStr;
    const scopes = shopToScopes.get(shopId);
    if (!scopes || scopes.size === 0) {
      void refreshShopIndex().then(() => {
        const g2 = shopToScopes.get(shopId);
        if (!g2 || g2.size === 0) return;
        for (const sk of g2) {
          const dk = `${sk}:${snap.questKey}:upd`;
          if (kind === "new") {
            void announceToScope(sk, row, "new");
          } else {
            debouncer(dk, () => announceToScope(sk, row, "update"));
          }
        }
      });
      return;
    }

    for (const sk of scopes) {
      const dk = `${sk}:${snap.questKey}:upd`;
      if (kind === "new") {
        void announceToScope(sk, row, "new");
      } else {
        debouncer(dk, () => announceToScope(sk, row, "update"));
      }
    }
  };

  /**
   * Inserts: snapshot replay (insert without a prior live delete) is ignored.
   * Live delete + insert with the same quest key is treated as an **update** (common for quantity edits).
   */
  const onTradeInserted = (row: TradeOrderState): void => {
    const snap = mapTradeOrderToSnapshot(row);
    questCache.upsert(snap);
    if (!dataReady) return;
    if (keysFromHydration.has(snap.questKey)) {
      return;
    }
    const wasReinsertAfterDelete = deletedQuestKeys.delete(snap.questKey);
    keysFromHydration.add(snap.questKey);
    if (!canAnnounceLive()) return;
    if (wasReinsertAfterDelete) {
      dispatchQuestAnnounce(row, "update");
      return;
    }
    const shopId = snap.shopEntityIdStr;
    const insertAt = Date.now();
    setTimeout(() => {
      if (!canAnnounceLive()) return;
      const last = lastDeleteByShop.get(shopId);
      if (
        last &&
        last.questKey !== snap.questKey &&
        (last.at > insertAt
          ? last.at - insertAt < replaceAfterDeleteMs
          : insertAt - last.at < replaceBeforeDeleteMs)
      ) {
        lastDeleteByShop.delete(shopId);
        dispatchQuestAnnounce(row, "update");
      } else {
        dispatchQuestAnnounce(row, "new");
      }
    }, newAnnounceDeferMs);
  };

  /** Updates only: live row changes → Quest update (optional). */
  const onTradeUpdated = (row: TradeOrderState): void => {
    const snap = mapTradeOrderToSnapshot(row);
    questCache.upsert(snap);
    if (!dataReady) return;
    if (!canAnnounceLive()) return;
    dispatchQuestAnnounce(row, "update");
  };

  const onTradeRemoved = (row: TradeOrderState): void => {
    const snap = mapTradeOrderToSnapshot(row);
    const key = snap.questKey;
    questCache.remove(key);
    keysFromHydration.delete(key);
    deletedQuestKeys.add(key);
    lastDeleteByShop.set(snap.shopEntityIdStr, {
      questKey: key,
      at: Date.now(),
    });
  };

  connection.db.travelerTradeOrderDesc.onInsert((_ctx, row) => {
    travelerDescById.set(row.id, row);
  });
  connection.db.travelerTradeOrderDesc.onUpdate((_ctx, _o, row) => {
    travelerDescById.set(row.id, row);
  });
  connection.db.travelerTradeOrderDesc.onDelete((_ctx, row) => {
    travelerDescById.delete(row.id);
  });

  connection.db.tradeOrderState.onInsert((_ctx, row) => {
    onTradeInserted(row);
  });
  connection.db.tradeOrderState.onUpdate((_ctx, _old, row) => {
    onTradeUpdated(row);
  });
  connection.db.tradeOrderState.onDelete((_ctx, row) => {
    onTradeRemoved(row);
  });

  const markSubscriptionApplied = (): void => {
    subscriptionsReady += 1;
    if (subscriptionsReady < 2) return;
    try {
      for (const row of connection.db.travelerTradeOrderDesc.iter()) {
        travelerDescById.set(row.id, row);
      }
      keysFromHydration.clear();
      deletedQuestKeys.clear();
      lastDeleteByShop.clear();
      for (const row of connection.db.tradeOrderState.iter()) {
        const snap = mapTradeOrderToSnapshot(row);
        keysFromHydration.add(snap.questKey);
        questCache.upsert(snap);
      }
    } catch (e: unknown) {
      log.warn("quest projection initial sync failed", e);
    }
    announceNotBefore = Date.now() + config.questAnnounceGraceMs;
    dataReady = true;
    log.info(
      "Quest subscriptions ready",
      `traveler_desc=${travelerDescById.size} trade_orders=${connection.db.tradeOrderState.count()}`
    );
  };

  connection
    .subscriptionBuilder()
    .onApplied(markSubscriptionApplied)
    .subscribe("SELECT * FROM traveler_trade_order_desc");

  connection
    .subscriptionBuilder()
    .onApplied(markSubscriptionApplied)
    .subscribe("SELECT * FROM trade_order_state");

  connection.reducers.onBarterStallOrderAccept((ctx, request) => {
    if (ctx.event.status.tag !== "Committed") return;
    const shopId = request.shopEntityId.toString();
    const questEntityId = request.tradeOrderEntityId.toString();
    const scopes = shopToScopes.get(shopId);
    if (!scopes || scopes.size === 0) return;

    const subjectKey = `s:${ctx.event.callerIdentity.toHexString()}`;

    for (const sk of scopes) {
      const { discordGuildId, forgeChannelId } = parseScopeKey(sk);
      void repo
        .recordQuestCompletion(
          discordGuildId,
          forgeChannelId,
          shopId,
          questEntityId,
          subjectKey
        )
        .then((r) => {
          if (r === "ok") {
            log.debug(
              "recorded barter completion",
              `guild=${discordGuildId}`,
              `forgeCh=${forgeChannelId}`,
              `order=${questEntityId}`
            );
          }
        })
        .catch((e: unknown) => {
          log.warn("recordQuestCompletion failed", e);
        });
    }
  });
}
