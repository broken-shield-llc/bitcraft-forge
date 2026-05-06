import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type InteractionEditReplyOptions,
  StringSelectMenuBuilder,
} from "discord.js";
import {
  QUEST_REWARDS_ALL_STORES_VALUE,
  type QuestRewardsListResult,
} from "@forge/application";

const EMBED_DESC_MAX = 4096;
export const QUEST_REWARDS_EMBED_COLOR = 0x2b2d31;
const RW_SEP = "|";

export type ParsedForgeRewardsCustomId =
  | { type: "reward_shop_select"; forgeChannelId: string }
  | { type: "reward_list_page"; page: number; forgeChannelId: string }
  | { type: "reward_back"; forgeChannelId: string }
  | { type: "reward_detail_prev"; forgeChannelId: string }
  | { type: "reward_detail_next"; forgeChannelId: string };

export function forgeRwShopCustomId(forgeChannelId: string): string {
  return `forge_rw_shop${RW_SEP}${forgeChannelId}`;
}

export function forgeRwPageCustomId(
  page: number,
  forgeChannelId: string
): string {
  return `forge_rw_page${RW_SEP}${page}${RW_SEP}${forgeChannelId}`;
}

export function forgeRwBackCustomId(forgeChannelId: string): string {
  return `forge_rw_back${RW_SEP}${forgeChannelId}`;
}

export function forgeRwDetailPrevCustomId(forgeChannelId: string): string {
  return `forge_rw_dprev${RW_SEP}${forgeChannelId}`;
}

export function forgeRwDetailNextCustomId(forgeChannelId: string): string {
  return `forge_rw_dnext${RW_SEP}${forgeChannelId}`;
}

export function parseForgeRewardsCustomId(
  customId: string
): ParsedForgeRewardsCustomId | null {
  if (!customId.startsWith("forge_rw_")) return null;
  const parts = customId.split(RW_SEP);
  if (parts.length < 2) return null;
  const head = parts[0]!;
  if (head === "forge_rw_shop" && parts.length === 2) {
    return { type: "reward_shop_select", forgeChannelId: parts[1]! };
  }
  if (head === "forge_rw_back" && parts.length === 2) {
    return { type: "reward_back", forgeChannelId: parts[1]! };
  }
  if (head === "forge_rw_dprev" && parts.length === 2) {
    return { type: "reward_detail_prev", forgeChannelId: parts[1]! };
  }
  if (head === "forge_rw_dnext" && parts.length === 2) {
    return { type: "reward_detail_next", forgeChannelId: parts[1]! };
  }
  if (head === "forge_rw_page" && parts.length === 3) {
    const page = Number(parts[1]);
    if (!Number.isFinite(page) || page < 0) return null;
    return {
      type: "reward_list_page",
      page: Math.floor(page),
      forgeChannelId: parts[2]!,
    };
  }
  return null;
}

export function isForgeRewardsComponent(customId: string): boolean {
  return parseForgeRewardsCustomId(customId) !== null;
}

/** Buttons only (exclude select menu ids). */
export function isForgeRewardsButtonComponent(customId: string): boolean {
  const p = parseForgeRewardsCustomId(customId);
  return p !== null && p.type !== "reward_shop_select";
}

/** Strip Stall rewards headline (same role as stripQuestBoardTitleLine for banner layouts). */
export function stripStallRewardsTitleLine(text: string): string {
  let t = text
    .replace(/^\*\*Stall rewards\*\*[^\n]*\r?\n/u, "")
    .replace(/^\n/u, "");
  t = t
    .replace(/^\*\*Stall rewards\*\* \(continued\)[^\n]*\r?\n/u, "")
    .replace(/^\n/u, "");
  return t;
}

export type StallRewardsEmbedResult = {
  content: string;
  embeds: EmbedBuilder[];
};

export function buildStallRewardsEmbeds(
  fullContent: string,
  bannerUrl: string | undefined
): StallRewardsEmbedResult {
  const trimmed = bannerUrl?.trim();
  if (!trimmed) {
    return { content: fullContent, embeds: [] };
  }

  let body = stripStallRewardsTitleLine(fullContent);
  if (body.length > EMBED_DESC_MAX) {
    body = body.slice(0, Math.max(0, EMBED_DESC_MAX - 1)) + "…";
  }

  const bannerEmbed = new EmbedBuilder()
    .setColor(QUEST_REWARDS_EMBED_COLOR)
    .setImage(trimmed);

  const textEmbed = new EmbedBuilder()
    .setColor(QUEST_REWARDS_EMBED_COLOR)
    .setDescription(body);

  return {
    content: "",
    embeds: [bannerEmbed, textEmbed],
  };
}

export function stallRewardsEditPayload(
  fullContent: string,
  bannerUrl: string | undefined,
  components?: InteractionEditReplyOptions["components"]
): InteractionEditReplyOptions {
  const { content, embeds } = buildStallRewardsEmbeds(fullContent, bannerUrl);
  const out: InteractionEditReplyOptions = { content, embeds };
  if (components !== undefined) out.components = components;
  return out;
}

export function buildRewardsListComponents(
  list: Extract<QuestRewardsListResult, { kind: "list" }>,
  forgeChannelId: string
): ActionRowBuilder[] {
  const rows: ActionRowBuilder[] = [];
  const select = new StringSelectMenuBuilder()
    .setCustomId(forgeRwShopCustomId(forgeChannelId))
    .setPlaceholder("Choose stall or combined totals…")
    .addOptions(
      {
        label: truncateSelectLabel(
          `All stores (combined totals) (${list.totalOffers} orders)`
        ),
        value: QUEST_REWARDS_ALL_STORES_VALUE,
      },
      ...list.shops.map((s) => ({
        label: s.label,
        value: s.shopEntityIdStr,
      }))
    );
  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)
  );

  if (list.totalPages > 1) {
    const prev = new ButtonBuilder()
      .setCustomId(forgeRwPageCustomId(list.page - 1, forgeChannelId))
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(list.page <= 0);
    const next = new ButtonBuilder()
      .setCustomId(forgeRwPageCustomId(list.page + 1, forgeChannelId))
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(list.page >= list.totalPages - 1);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next));
  }

  return rows;
}

function truncateSelectLabel(label: string, max = 100): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

export type ForgeRewardsDetailComponentsInput = {
  detailPageIdx: number;
  totalDetailPages: number;
};

export function buildRewardsDetailComponents(
  forgeChannelId: string,
  detail: ForgeRewardsDetailComponentsInput
): ActionRowBuilder[] {
  const back = new ButtonBuilder()
    .setCustomId(forgeRwBackCustomId(forgeChannelId))
    .setLabel("Back to stall picker")
    .setStyle(ButtonStyle.Primary);

  const prev = new ButtonBuilder()
    .setCustomId(forgeRwDetailPrevCustomId(forgeChannelId))
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(detail.detailPageIdx <= 0 || detail.totalDetailPages <= 1);

  const next = new ButtonBuilder()
    .setCustomId(forgeRwDetailNextCustomId(forgeChannelId))
    .setLabel("Next")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(
      detail.detailPageIdx >= detail.totalDetailPages - 1 ||
        detail.totalDetailPages <= 1
    );

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(prev, back, next),
  ];
}
