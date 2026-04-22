import {
  formatItemStacksWithNames,
  formatOfferStacksHighlightingLegendaryPlus,
  isLegendaryPlusRarityTag,
  isQuestOfferVisibleOnBoard,
  questBoardLegendaryPlusRowBadge,
  sortQuestOffersForBoard,
  type QuestOfferReadPort,
  type QuestOfferSnapshot,
  type StallInventoryBoardPort,
} from "@forge/domain";
import type { EntityCacheRepository, GuildConfigRepository } from "@forge/repos";

/** Shop detail body budget: Discord embed description max is 4096 chars; banner mode uses a separate image embed, text goes in the second embed. */
const MAX_BOARD_CHARS = 1950;
export const QUEST_BOARD_SHOPS_PER_PAGE = 25;
const MAX_DISCORD_SELECT_VALUE_LEN = 100;

function emptyNoBuildings(commandName: string): string {
  return `No monitored buildings in this channel yet — run \`/${commandName} enable\` if needed, then add one with \`/${commandName} building add\`, and wait for SpacetimeDB data.`;
}

function emptyWithBuildings(commandName: string): string {
  return [
    "No quests in the live cache for your monitored buildings.",
    "",
    "The board only lists orders whose **shop** id matches a **monitored building id** (same BitCraft entity id). If you picked the wrong building, or there are no active trade orders for those stalls, the list stays empty.",
    `If the bot just connected, wait a few seconds and try again. \`/${commandName} health\` shows whether \`trade_order_state\` is syncing (row count).`,
  ].join("\n");
}

export type QuestBoardDeps = {
  repo: Pick<GuildConfigRepository, "listBuildings">;
  entityCacheRepo: Pick<
    EntityCacheRepository,
    | "getInventoryBoardSnapshotForOwners"
    | "getItemNames"
    | "getItemRarityTags"
    | "getBuildingNicknames"
    | "getClaimNameForBuilding"
  >;
  questOffers: QuestOfferReadPort;
  /** Slash root (e.g. `forge`). Defaults to `forge`. */
  discordCommandName?: string;
};

type PreparedOk = {
  shopOrder: string[];
  byShop: Map<string, QuestOfferSnapshot[]>;
  shopNicks: Map<string, string>;
  itemNames: Map<number, string>;
  rarityTags: Map<number, string>;
  totalOffers: number;
};

async function prepareQuestBoard(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestBoardDeps
): Promise<
  | { kind: "no_buildings" }
  | { kind: "no_offers" }
  | ({ kind: "ok" } & PreparedOk)
> {
  const buildings = await deps.repo.listBuildings(
    discordGuildId,
    forgeChannelId
  );
  if (buildings.length === 0) return { kind: "no_buildings" };

  const ids = new Set(buildings.map((b) => b.buildingId));
  const sorted = sortQuestOffersForBoard(
    deps.questOffers.snapshotForMonitoredBuildings(ids)
  );
  const shopIds = [...new Set(sorted.map((o) => o.shopEntityIdStr))];
  const invSnap =
    await deps.entityCacheRepo.getInventoryBoardSnapshotForOwners(shopIds);
  const boardPort: StallInventoryBoardPort = {
    hasInventoryDataForOwner: (id) => invSnap.get(id)?.hasData ?? false,
    getTotalsForOwner: (id) => invSnap.get(id)?.totals ?? new Map(),
  };
  const offers = sorted.filter((o) =>
    isQuestOfferVisibleOnBoard(o, boardPort)
  );
  if (offers.length === 0) return { kind: "no_offers" };

  const shopOrder: string[] = [];
  const byShop = new Map<string, QuestOfferSnapshot[]>();
  for (const o of offers) {
    if (!byShop.has(o.shopEntityIdStr)) {
      shopOrder.push(o.shopEntityIdStr);
      byShop.set(o.shopEntityIdStr, []);
    }
    byShop.get(o.shopEntityIdStr)!.push(o);
  }

  const itemIds = new Set<number>();
  for (const o of offers) {
    for (const s of o.offerStacks ?? []) itemIds.add(s.itemId);
    for (const s of o.requiredStacks ?? []) itemIds.add(s.itemId);
  }
  const itemNames = await deps.entityCacheRepo.getItemNames([...itemIds]);
  const offerItemIds = new Set<number>();
  for (const o of offers) {
    for (const s of o.offerStacks ?? []) offerItemIds.add(s.itemId);
  }
  const rarityTags = await deps.entityCacheRepo.getItemRarityTags([
    ...offerItemIds,
  ]);
  const shopNicks =
    await deps.entityCacheRepo.getBuildingNicknames(shopOrder);

  return {
    kind: "ok",
    shopOrder,
    byShop,
    shopNicks,
    itemNames,
    rarityTags,
    totalOffers: offers.length,
  };
}

function truncateDiscord(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

export type QuestBoardListShopRow = {
  shopEntityIdStr: string;
  label: string;
  offerCount: number;
};

export type QuestBoardListResult =
  | { kind: "no_buildings"; content: string }
  | { kind: "no_offers"; content: string }
  | {
      kind: "list";
      content: string;
      totalShops: number;
      totalOffers: number;
      page: number;
      pageSize: number;
      totalPages: number;
      shops: QuestBoardListShopRow[];
    };

export async function executeQuestBoardList(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestBoardDeps,
  page: number
): Promise<QuestBoardListResult> {
  const cmd = deps.discordCommandName ?? "forge";
  const p = await prepareQuestBoard(discordGuildId, forgeChannelId, deps);
  if (p.kind === "no_buildings") {
    return { kind: "no_buildings", content: emptyNoBuildings(cmd) };
  }
  if (p.kind === "no_offers") {
    return { kind: "no_offers", content: emptyWithBuildings(cmd) };
  }

  const { shopOrder, byShop, shopNicks, totalOffers } = p;
  const validOrder = shopOrder.filter(
    (id) => id.length <= MAX_DISCORD_SELECT_VALUE_LEN
  );
  const skippedLongIds = shopOrder.length - validOrder.length;
  if (validOrder.length === 0) {
    return {
      kind: "no_offers",
      content:
        skippedLongIds > 0
          ? "Every visible shop has a building id longer than Discord allows for menus (100 characters). The quest board can’t list them here."
          : emptyWithBuildings(cmd),
    };
  }

  const pageSize = QUEST_BOARD_SHOPS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(validOrder.length / pageSize));
  const pageSafe = Math.min(Math.max(0, page), totalPages - 1);
  const slice = validOrder.slice(
    pageSafe * pageSize,
    pageSafe * pageSize + pageSize
  );

  const shops: QuestBoardListShopRow[] = slice.map((id) => {
    const nick = shopNicks.get(id)?.trim();
    const name = nick && nick.length > 0 ? nick : "—";
    const offerCount = byShop.get(id)!.length;
    const label = truncateDiscord(
      `${name} · ${offerCount} offer${offerCount === 1 ? "" : "s"}`,
      100
    );
    return { shopEntityIdStr: id, label, offerCount };
  });

  const pageLine =
    totalPages > 1
      ? `Page **${pageSafe + 1}** / **${totalPages}** — pick a shop below.`
      : "Pick a shop below to see quests.";

  const skipNote =
    skippedLongIds > 0
      ? `\n_Note: ${skippedLongIds} shop(s) have building ids too long for Discord menus and are omitted._`
      : "";

  const content = [
    "**Quest board**",
    "",
    `${totalOffers} offer${totalOffers === 1 ? "" : "s"} across **${shopOrder.length}** shop${shopOrder.length === 1 ? "" : "s"}.`,
    pageLine,
    skipNote,
    "",
  ].join("\n");

  return {
    kind: "list",
    content,
    totalShops: shopOrder.length,
    totalOffers,
    page: pageSafe,
    pageSize,
    totalPages,
    shops,
  };
}

function buildOfferLines(
  o: QuestOfferSnapshot,
  itemNames: Map<number, string>,
  rarityTags: Map<number, string>
): string[] {
  const hasLegendaryPlusReward = (o.offerStacks ?? []).some((s) => {
    const t = rarityTags.get(s.itemId);
    return typeof t === "string" && isLegendaryPlusRarityTag(t);
  });
  const offerLine =
    o.offerStacks && o.offerStacks.length > 0
      ? formatOfferStacksHighlightingLegendaryPlus(
          o.offerStacks,
          itemNames,
          rarityTags
        )
      : o.offerSummary;
  const reqLine =
    o.requiredStacks && o.requiredStacks.length > 0
      ? formatItemStacksWithNames(o.requiredStacks, itemNames)
      : o.requiredSummary;
  const body: string[] = [];
  if (hasLegendaryPlusReward) {
    body.push(questBoardLegendaryPlusRowBadge());
  }
  body.push(
    `**Offer:** ${offerLine}`,
    `**Request:** ${reqLine}`,
    `**Stock:** ${o.remainingStock}`
  );
  return body;
}

function offerBlockText(
  o: QuestOfferSnapshot,
  itemNames: Map<number, string>,
  rarityTags: Map<number, string>,
  isFirstInPage: boolean
): string {
  const lines = buildOfferLines(o, itemNames, rarityTags);
  const s = lines.join("\n");
  return isFirstInPage ? s : `\n\n${s}`;
}

function buildShopBaseHeader(
  claimDisplay: string,
  buildingName: string,
  offerCount: number
): string {
  const w = offerCount === 1 ? "offer" : "offers";
  return [
    "**Quest board**",
    "",
    `**${claimDisplay} - ${buildingName}** (${offerCount} ${w})`,
    "",
  ].join("\n");
}

function buildShopPageHeader(
  baseHeader: string,
  pageIdx: number,
  totalPages: number
): string {
  if (totalPages <= 1) return baseHeader;
  return `${baseHeader}_Page **${pageIdx + 1}** of **${totalPages}**_\n\n`;
}

/**
 * Splits a shop’s offers into one string per "page" so each page fits the embed
 * text budget, using the same per-offer layout as a single unbounded board.
 */
function splitShopOffersIntoPages(
  shopOffers: QuestOfferSnapshot[],
  itemNames: Map<number, string>,
  rarityTags: Map<number, string>,
  baseHeader: string
): string[] {
  const n = shopOffers.length;
  if (n === 0) {
    return [buildShopPageHeader(baseHeader, 0, 1) + "_No offers._"];
  }

  let full = buildShopPageHeader(baseHeader, 0, 1);
  for (let i = 0; i < n; i++) {
    full += offerBlockText(shopOffers[i]!, itemNames, rarityTags, i === 0);
  }
  if (full.length <= MAX_BOARD_CHARS) {
    return [full];
  }

  const packHeader = `${baseHeader}_Page **99** of **99**_\n\n`;
  const bodyBudget = MAX_BOARD_CHARS - packHeader.length;
  if (bodyBudget < 32) {
    return [full.slice(0, MAX_BOARD_CHARS - 3) + "…"];
  }

  const ranges: [number, number][] = [];
  let start = 0;
  while (start < n) {
    let t = "";
    let end = start;
    for (let e = start; e < n; e++) {
      const add = offerBlockText(shopOffers[e]!, itemNames, rarityTags, e === start);
      const next = t + add;
      if (next.length > bodyBudget && t.length > 0) {
        break;
      }
      t = next;
      end = e + 1;
    }
    if (end === start) {
      end = start + 1;
    }
    ranges.push([start, end]);
    start = end;
  }

  return ranges.map(([from, to], pageIdx) => {
    const totalPages = ranges.length;
    const head = buildShopPageHeader(baseHeader, pageIdx, totalPages);
    let b = "";
    for (let i = from; i < to; i++) {
      b += offerBlockText(shopOffers[i]!, itemNames, rarityTags, i === from);
    }
    let out = head + b;
    if (out.length > MAX_BOARD_CHARS) {
      out = out.slice(0, MAX_BOARD_CHARS - 3) + "…";
    }
    return out;
  });
}

export type QuestBoardShopDetailResult =
  | { kind: "not_found"; content: string }
  | {
      kind: "ok";
      content: string;
      offerPage: number;
      totalOfferPages: number;
      offerCount: number;
    };

export async function executeQuestBoardShopDetail(
  discordGuildId: string,
  forgeChannelId: string,
  shopEntityIdStr: string,
  deps: QuestBoardDeps,
  offerPage: number = 0
): Promise<QuestBoardShopDetailResult> {
  const cmd = deps.discordCommandName ?? "forge";
  const p = await prepareQuestBoard(discordGuildId, forgeChannelId, deps);
  if (p.kind === "no_buildings") {
    return { kind: "not_found", content: emptyNoBuildings(cmd) };
  }
  if (p.kind === "no_offers") {
    return { kind: "not_found", content: emptyWithBuildings(cmd) };
  }

  const shopOffers = p.byShop.get(shopEntityIdStr);
  if (!shopOffers || shopOffers.length === 0) {
    return {
      kind: "not_found",
      content:
        "That shop isn’t on this board (no visible offers, or it isn’t monitored).",
    };
  }

  const nick = p.shopNicks.get(shopEntityIdStr)?.trim();
  const buildingName = nick && nick.length > 0 ? nick : "—";
  let claimName: string | undefined;
  try {
    claimName = await deps.entityCacheRepo.getClaimNameForBuilding(
      shopEntityIdStr
    );
  } catch {
    void 0;
  }
  const claimDisplay = claimName?.trim() || "—";
  const baseHeader = buildShopBaseHeader(
    claimDisplay,
    buildingName,
    shopOffers.length
  );
  const pages = splitShopOffersIntoPages(
    shopOffers,
    p.itemNames,
    p.rarityTags,
    baseHeader
  );
  const totalOfferPages = pages.length;
  const safePage = Math.min(
    Math.max(0, offerPage),
    totalOfferPages - 1
  );
  return {
    kind: "ok",
    content: pages[safePage]!,
    offerPage: safePage,
    totalOfferPages,
    offerCount: shopOffers.length,
  };
}
