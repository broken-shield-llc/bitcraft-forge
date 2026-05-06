import type {
  EntityCacheRepository,
  GuildConfigRepository,
} from "@forge/repos";
import type { QuestOfferReadPort, QuestOfferSnapshot } from "@forge/domain";
import { sortQuestOffersForBoard } from "@forge/domain";

export type QuestRewardsDeps = {
  repo: Pick<GuildConfigRepository, "listBuildings">;
  entityCacheRepo: Pick<
    EntityCacheRepository,
    | "getItemNames"
    | "getBuildingNicknames"
    | "getClaimNameForBuilding"
  >;
  questOffers: QuestOfferReadPort;
  discordCommandName?: string;
};

/** Select menu option value — combined totals across every monitored stall in scope. */
export const QUEST_REWARDS_ALL_STORES_VALUE = "__forge_all_stores__";

export const QUEST_REWARDS_DISCORD_TITLE = "**Stall rewards**";
export const QUEST_REWARDS_DETAIL_CONTINUED_TITLE =
  "**Stall rewards** (continued)";
const TITLE_CONT_LOWER = QUEST_REWARDS_DETAIL_CONTINUED_TITLE;

/** Old heading stripped by {@link splitQuestRewardsForDiscord} (historic copy). Exported for tests only. */
export const QUEST_REWARDS_LEGACY_EPHEMERAL_TITLE =
  "**Stall reward shopping list**";

export const QUEST_REWARDS_SHOPS_PER_PAGE = 24;
const MAX_DISCORD_SELECT_VALUE_LEN = 100;
const MAX_EMBED_DETAIL_CHARS = 3900;

function truncateDiscordLabel(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

function emptyNoBuildings(commandName: string): string {
  return `No monitored buildings in this channel yet — run \`/${commandName} enable\` if needed, then add one with \`/${commandName} building add\`.`;
}

function aggregateRewardNeeds(offers: QuestOfferSnapshot[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const o of offers) {
    if (o.remainingStock <= 0) continue;
    const stacks = o.offerStacks ?? [];
    for (const s of stacks) {
      const add = Math.max(
        0,
        Number(s.quantity) * Number(o.remainingStock)
      );
      const prev = totals.get(s.itemId) ?? 0;
      totals.set(s.itemId, prev + add);
    }
  }
  return totals;
}

export type QuestRewardsListShopRow = {
  shopEntityIdStr: string;
  label: string;
  offerCount: number;
};

export type QuestRewardsListResult =
  | { kind: "no_buildings"; content: string }
  | { kind: "no_open_orders"; content: string }
  | {
      kind: "list";
      content: string;
      /** Shoppable stalls only (omit ids too long for Discord select values). */
      totalShops: number;
      totalOffers: number;
      page: number;
      totalPages: number;
      shops: QuestRewardsListShopRow[];
      skippedLongIds: number;
    };

/** Build sorted reward quantity lines (`Name ×qty`, quest-board–style tally). */
function buildTotalsMarkdownLines(
  openOffers: QuestOfferSnapshot[],
  itemNames: Map<number, string | undefined>
): string[] {
  const totalsMap = aggregateRewardNeeds(openOffers);
  const rows: { itemId: number; qty: number; label: string }[] = [];
  for (const [itemId, qty] of totalsMap) {
    const n = itemNames.get(itemId);
    const label = n?.trim() ? n.trim() : String(itemId);
    rows.push({ itemId, qty, label });
  }
  rows.sort((a, b) => {
    if (b.qty !== a.qty) return b.qty - a.qty;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  const lineItems = rows.map((r) => `${r.label} ×${r.qty}`);
  return ["**Total**", ...lineItems];
}

/**
 * Split body markdown into Discord embed-sized pages (4096-safe budget).
 */
function paginateRewardsDetailBodies(bodyMarkdown: string): string[] {
  const body = bodyMarkdown.trimEnd();
  const TITLE = QUEST_REWARDS_DISCORD_TITLE;
  const CONT = QUEST_REWARDS_DETAIL_CONTINUED_TITLE;
  const single = TITLE + "\n\n" + body;
  if (single.length <= MAX_EMBED_DETAIL_CHARS) return [single];

  const PAGE_LINE_EXTRA = "_Page **9** of **9**_\n\n".length;
  const lines = body.split("\n");
  const packs: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const pageIdx = packs.length;
    const headerGuess =
      (pageIdx === 0 ? TITLE.length : CONT.length) + 2 + PAGE_LINE_EXTRA;
    let budget = MAX_EMBED_DETAIL_CHARS - headerGuess;
    let chunk = "";

    while (i < lines.length) {
      const line = lines[i]!;
      const next = chunk + (chunk ? "\n" : "") + line;
      if (next.length > budget && chunk.length > 0) break;
      if (next.length > budget && chunk.length === 0) {
        chunk =
          line.length > budget ? line.slice(0, budget - 3) + "…" : line;
        i++;
        break;
      }
      chunk = next;
      i++;
    }
    packs.push(chunk.trimEnd());
  }

  const total = packs.length;
  return packs.map((chunk, pi) => {
    const t = pi === 0 ? TITLE : CONT;
    const head =
      total <= 1
        ? `${t}\n\n`
        : `${t}\n_Page **${pi + 1}** of **${total}**_\n\n`;
    return (head + chunk).trimEnd();
  });
}

export type QuestRewardsTotalsDetailResult =
  | { kind: "not_found"; content: string }
  | {
      kind: "ok";
      /** One embed description markdown page (`detailPage`). */
      content: string;
      offerCount: number;
      totalsDetailPages: number;
      detailPage: number;
    };

/**
 * Stall reward-stock totals for pickers (**All stores** or one stall).
 *
 * `detailPage` selects which paginated markdown chunk when the body exceeds Discord embed limits.
 */
export async function executeQuestRewardsTotalsDetail(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestRewardsDeps,
  scopeRaw: string,
  detailPage: number = 0
): Promise<QuestRewardsTotalsDetailResult> {
  const buildings = await deps.repo.listBuildings(
    discordGuildId,
    forgeChannelId
  );
  const cmd = deps.discordCommandName ?? "forge";
  if (buildings.length === 0) {
    return {
      kind: "not_found",
      content: emptyNoBuildings(cmd),
    };
  }

  const allIds = new Set(buildings.map((b) => b.buildingId));
  let monitoredIds: Set<string>;

  if (scopeRaw === QUEST_REWARDS_ALL_STORES_VALUE) {
    monitoredIds = allIds;
  } else {
    if (scopeRaw.length > MAX_DISCORD_SELECT_VALUE_LEN) {
      return { kind: "not_found", content: "Invalid stall selection." };
    }
    if (!allIds.has(scopeRaw)) {
      return {
        kind: "not_found",
        content:
          "That stall is not monitored here. Open **Stall rewards** again from `/quest rewards`.",
      };
    }
    monitoredIds = new Set([scopeRaw]);
  }

  const sortedOffers = sortQuestOffersForBoard(
    deps.questOffers.snapshotForMonitoredBuildings(allIds)
  );
  const openOffers = sortedOffers.filter(
    (o) =>
      o.remainingStock > 0 && monitoredIds.has(o.shopEntityIdStr)
  );

  const offerCount = openOffers.length;
  if (offerCount === 0) {
    return {
      kind: "not_found",
      content: [
        QUEST_REWARDS_DISCORD_TITLE,
        "",
        `_No open orders for this scope._`,
      ].join("\n"),
    };
  }

  const w = offerCount === 1 ? "offer" : "offers";

  /** Same shape as quest board shop line: **Claim - Building** (N offers). */
  let scopeLine: string;
  if (scopeRaw === QUEST_REWARDS_ALL_STORES_VALUE) {
    scopeLine = `**All stores** (${offerCount} ${w})`;
  } else {
    const nick =
      (
        await deps.entityCacheRepo.getBuildingNicknames([scopeRaw])
      ).get(scopeRaw)?.trim();
    let claimName: string | undefined;
    try {
      claimName = await deps.entityCacheRepo.getClaimNameForBuilding(
        scopeRaw
      );
    } catch {
      void 0;
    }
    const buildingName = nick && nick.length > 0 ? nick : "—";
    const claimDisplay = claimName?.trim() || "—";
    scopeLine = `**${claimDisplay} - ${buildingName}** (${offerCount} ${w})`;
  }

  const summaryBlock = `${scopeLine}\n\n`;

  const totalsMap = aggregateRewardNeeds(openOffers);
  const itemIds = [...totalsMap.keys()];
  const itemNames =
    itemIds.length > 0
      ? await deps.entityCacheRepo.getItemNames(itemIds)
      : new Map<number, string | undefined>();
  const totalsLines = buildTotalsMarkdownLines(openOffers, itemNames).join("\n");

  const fullBody = `${summaryBlock}${totalsLines}`;
  const pages = paginateRewardsDetailBodies(fullBody);
  const totalDp = Math.max(1, pages.length);
  const dp = Math.min(Math.max(0, detailPage), totalDp - 1);

  return {
    kind: "ok",
    content: pages[dp]!,
    offerCount,
    totalsDetailPages: totalDp,
    detailPage: dp,
  };
}

function openOffersFromCache(
  allMonitoredIds: Set<string>,
  questOffers: QuestOfferReadPort
): QuestOfferSnapshot[] {
  const sortedOffers = sortQuestOffersForBoard(
    questOffers.snapshotForMonitoredBuildings(allMonitoredIds)
  );
  return sortedOffers.filter((o) => o.remainingStock > 0);
}

export async function executeQuestRewardsList(
  discordGuildId: string,
  forgeChannelId: string,
  deps: QuestRewardsDeps,
  page: number
): Promise<QuestRewardsListResult> {
  const cmd = deps.discordCommandName ?? "forge";
  const buildings = await deps.repo.listBuildings(
    discordGuildId,
    forgeChannelId
  );
  if (buildings.length === 0)
    return { kind: "no_buildings", content: emptyNoBuildings(cmd) };

  const monitoredIds = new Set(buildings.map((b) => b.buildingId));
  const openOffers = openOffersFromCache(monitoredIds, deps.questOffers);
  const totalOffers = openOffers.length;
  if (totalOffers === 0) {
    return {
      kind: "no_open_orders",
      content: [
        QUEST_REWARDS_DISCORD_TITLE,
        "",
        "No open orders for monitored stalls.",
      ].join("\n"),
    };
  }

  const shopOrder: string[] = [];
  const counts = new Map<string, number>();
  for (const o of openOffers) {
    counts.set(o.shopEntityIdStr, (counts.get(o.shopEntityIdStr) ?? 0) + 1);
    if (!shopOrder.includes(o.shopEntityIdStr)) {
      shopOrder.push(o.shopEntityIdStr);
    }
  }

  const selectable = shopOrder.filter(
    (id) => id.length <= MAX_DISCORD_SELECT_VALUE_LEN
  );
  const skippedLongIds = shopOrder.length - selectable.length;
  const totalShopsInCache = selectable.length;

  const pageSize = QUEST_REWARDS_SHOPS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(selectable.length / pageSize));
  const pageSafe = Math.min(Math.max(0, page), totalPages - 1);
  const slice = selectable.slice(
    pageSafe * pageSize,
    pageSafe * pageSize + pageSize
  );

  const shopNicks = await deps.entityCacheRepo.getBuildingNicknames(slice);
  const shops: QuestRewardsListShopRow[] = slice.map((id) => {
    const nick = shopNicks.get(id)?.trim();
    const name = nick && nick.length > 0 ? nick : "—";
    const offerCount = counts.get(id) ?? 0;
    const label = truncateDiscordLabel(
      `${name} · ${offerCount} open order${offerCount === 1 ? "" : "s"}`,
      100
    );
    return { shopEntityIdStr: id, label, offerCount };
  });

  const pageLine =
    totalPages > 1
      ? `Page **${pageSafe + 1}** / **${totalPages}** — pick a stall or **All stores** below.`
      : `Pick a stall or **All stores** below for combined totals.`;

  const skipNote =
    skippedLongIds > 0
      ? `\n_Note: ${skippedLongIds} stall(s) have ids too long for Discord menus (${MAX_DISCORD_SELECT_VALUE_LEN} chars) — use building list elsewhere if you need those ids._`
      : "";

  const head = [
    QUEST_REWARDS_DISCORD_TITLE,
    "",
    `${totalOffers} offer${totalOffers === 1 ? "" : "s"} across ${totalShopsInCache} stall${totalShopsInCache === 1 ? "" : "s"}.`,
    pageLine + skipNote,
    "",
  ].join("\n");

  return {
    kind: "list",
    content: head,
    totalShops: totalShopsInCache,
    totalOffers,
    page: pageSafe,
    totalPages,
    shops,
    skippedLongIds,
  };
}

/**
 * Split Stall rewards plaintext for ephemeral follow-ups (≤2000 chars).
 * Strips {@link QUEST_REWARDS_DISCORD_TITLE} and legacy {@link QUEST_REWARDS_LEGACY_EPHEMERAL_TITLE}.
 */
export function splitQuestRewardsForDiscord(fullContent: string): string[] {
  if (fullContent.length <= 2000) return [fullContent];

  const stripTitles = fullContent
    .trim()
    .replace(/^\*\*Stall rewards\*\*[^\n]*\r?\n?/u, "")
    .replace(
      new RegExp(
        "^" +
          QUEST_REWARDS_LEGACY_EPHEMERAL_TITLE.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          ) +
          "\\s*\\r?\\n?",
        "u"
      ),
      ""
    );

  const firstBodyMax =
    2000 - (QUEST_REWARDS_DISCORD_TITLE.length + 1);
  const followBodyMax = 2000 - (TITLE_CONT_LOWER.length + 1);

  if (stripTitles.length === 0) return [fullContent.slice(0, 2000)];

  const lines = stripTitles.split("\n");
  const messages: string[] = [];
  let partLines: string[] = [];
  let partLen = 0;

  const bodyBudget = () =>
    messages.length === 0 ? firstBodyMax : followBodyMax;

  const flush = () => {
    if (partLines.length === 0) return;
    const t =
      messages.length === 0 ? QUEST_REWARDS_DISCORD_TITLE : TITLE_CONT_LOWER;
    messages.push(`${t}\n${partLines.join("\n")}`);
    partLines = [];
    partLen = 0;
  };

  for (const line of lines) {
    const b = bodyBudget();
    const add = (partLines.length === 0 ? 0 : 1) + line.length;
    if (partLines.length > 0 && partLen + add > b) flush();
    const b2 = bodyBudget();
    if (line.length > b2) {
      if (partLines.length) flush();
      let rest = line;
      while (rest.length > 0) {
        const t =
          messages.length === 0
            ? QUEST_REWARDS_DISCORD_TITLE
            : TITLE_CONT_LOWER;
        const max = messages.length === 0 ? firstBodyMax : followBodyMax;
        const chunk = rest.slice(0, max);
        rest = rest.slice(max);
        messages.push(`${t}\n${chunk}`);
      }
      continue;
    }
    if (partLines.length === 0) partLen = line.length;
    else partLen += 1 + line.length;
    partLines.push(line);
  }
  flush();

  return messages.length > 0 ? messages : [fullContent.slice(0, 2000)];
}
