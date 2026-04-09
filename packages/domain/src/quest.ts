/** Normalized quest / barter offer for board + announcements (no SpacetimeDB imports). */

export type QuestRarityTier = "low" | "medium" | "high";

export type QuestOfferSnapshot = {
  /** Stable key: shop + order entity ids */
  questKey: string;
  shopEntityIdStr: string;
  orderEntityIdStr: string;
  remainingStock: number;
  offerSummary: string;
  requiredSummary: string;
  /** For enriching labels from `stdb_item_cache`. */
  offerStacks?: ItemStackLike[];
  requiredStacks?: ItemStackLike[];
  travelerTradeOrderId: number | null;
};

export function questKeyFromParts(
  shopEntityId: bigint,
  orderEntityId: bigint
): string {
  return `${shopEntityId.toString()}:${orderEntityId.toString()}`;
}

/** Parse a monitored `building_id` string into bigint (BitCraft entity id). */
export function parseEntityIdString(raw: string): bigint | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

export type ItemStackLike = {
  itemId: number;
  quantity: number;
};

export function formatItemStacks(stacks: ItemStackLike[]): string {
  if (stacks.length === 0) return "—";
  return stacks
    .map((x) => `${x.itemId}×${x.quantity}`)
    .join(", ");
}

/** Same as `formatItemStacks` but uses cached display names when present. */
export function formatItemStacksWithNames(
  stacks: ItemStackLike[],
  names: Map<number, string | undefined>
): string {
  if (stacks.length === 0) return "—";
  return stacks
    .map((s) => {
      const n = names.get(s.itemId);
      const label = n?.trim() ? n.trim() : String(s.itemId);
      return `${label} ×${s.quantity}`;
    })
    .join(", ");
}

export function sortQuestOffersForBoard(
  rows: QuestOfferSnapshot[]
): QuestOfferSnapshot[] {
  return [...rows].sort((a, b) => {
    return a.questKey.localeCompare(b.questKey);
  });
}

/**
 * Leaderboard line for a completion subject (`d:<discordUserId>` or `s:<hex>`).
 */
export function formatCompletionSubjectDisplay(subjectKey: string): string {
  if (subjectKey.startsWith("d:")) {
    return `<@${subjectKey.slice(2)}>`;
  }
  if (subjectKey.startsWith("s:")) {
    const hex = subjectKey.slice(2);
    const short = hex.length > 18 ? `${hex.slice(0, 10)}…${hex.slice(-6)}` : hex;
    return `STDB \`${short}\``;
  }
  return subjectKey;
}

export type RewardRating = "legendary_plus";

export function isLegendaryPlusRarityTag(tag: string): boolean {
  // BitCraft Rarity tags: Default, Common, Uncommon, Rare, Epic, Legendary, Mythic
  return tag === "Legendary" || tag === "Mythic";
}

export function rewardRatingLabel(_r: RewardRating): string {
  void _r;
  return "SPECIAL";
}

/**
 * Markdown snippet for the quest board row when the offer includes a Legendary/Mythic reward.
 * (Discord: bold + decorative glyphs; pair with `formatOfferStacksHighlightingLegendaryPlus`.)
 */
export function questBoardLegendaryPlusRowBadge(): string {
  return "**✦ SPECIAL ✦**";
}

/**
 * Like `formatItemStacksWithNames`, but bolds (and underlines) each stack whose cached
 * rarity tag is Legendary or Mythic — the same items that trigger the SPECIAL row badge.
 */
export function formatOfferStacksHighlightingLegendaryPlus(
  stacks: ItemStackLike[],
  names: Map<number, string | undefined>,
  rarityTags: ReadonlyMap<number, string | undefined>
): string {
  if (stacks.length === 0) return "—";
  return stacks
    .map((s) => {
      const n = names.get(s.itemId);
      const label = n?.trim() ? n.trim() : String(s.itemId);
      const part = `${label} ×${s.quantity}`;
      const tag = rarityTags.get(s.itemId);
      if (typeof tag === "string" && isLegendaryPlusRarityTag(tag)) {
        return `**__${part}__**`;
      }
      return part;
    })
    .join(", ");
}
