import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type InteractionEditReplyOptions,
  StringSelectMenuBuilder,
} from "discord.js";
import type { QuestBoardListResult } from "@forge/application";

/** Discord embed description max length. */
const EMBED_DESC_MAX = 4096;

/** Sidebar / embed strip; matches Discord’s dark theme. */
const QUEST_BOARD_EMBED_COLOR = 0x2b2d31;

export const FORGE_QB_SELECT_CUSTOM_ID = "forge_qb_shop";
export const FORGE_QB_BACK_CUSTOM_ID = "forge_qb_back";
export const FORGE_QB_PAGE_PREFIX = "forge_qb_page:";

export function forgeQbPageCustomId(page: number): string {
  return `${FORGE_QB_PAGE_PREFIX}${page}`;
}

export function parseForgeQbPageCustomId(customId: string): number | null {
  if (!customId.startsWith(FORGE_QB_PAGE_PREFIX)) return null;
  const n = Number(customId.slice(FORGE_QB_PAGE_PREFIX.length));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function isForgeQuestBoardComponent(customId: string): boolean {
  return (
    customId === FORGE_QB_SELECT_CUSTOM_ID ||
    customId === FORGE_QB_BACK_CUSTOM_ID ||
    customId.startsWith(FORGE_QB_PAGE_PREFIX)
  );
}

/**
 * Removes the leading `**Quest board**` line when a banner image replaces that heading.
 */
export function stripQuestBoardTitleLine(text: string): string {
  return text.replace(/^\*\*Quest board\*\*\s*\n?/u, "");
}

export type QuestBoardEmbedsResult = {
  content: string;
  embeds: EmbedBuilder[];
};

/**
 * When `bannerUrl` is set (HTTPS image), returns two embeds: wide banner image, then body text.
 * Otherwise plain `content` only (no embeds).
 */
export function buildQuestBoardEmbeds(
  fullContent: string,
  bannerUrl: string | undefined
): QuestBoardEmbedsResult {
  const trimmed = bannerUrl?.trim();
  if (!trimmed) {
    return { content: fullContent, embeds: [] };
  }

  let body = stripQuestBoardTitleLine(fullContent);
  if (body.length > EMBED_DESC_MAX) {
    body = body.slice(0, EMBED_DESC_MAX - 1) + "…";
  }

  const bannerEmbed = new EmbedBuilder()
    .setColor(QUEST_BOARD_EMBED_COLOR)
    .setImage(trimmed);

  const textEmbed = new EmbedBuilder()
    .setColor(QUEST_BOARD_EMBED_COLOR)
    .setDescription(body);

  return {
    content: "",
    embeds: [bannerEmbed, textEmbed],
  };
}

/** Payload for `editReply` / `reply` including optional message components. */
export function questBoardEditPayload(
  fullContent: string,
  bannerUrl: string | undefined,
  components?: InteractionEditReplyOptions["components"]
): InteractionEditReplyOptions {
  const { content, embeds } = buildQuestBoardEmbeds(fullContent, bannerUrl);
  const out: InteractionEditReplyOptions = { content, embeds };
  if (components !== undefined) out.components = components;
  return out;
}

/**
 * Summary view: shop picker (+ prev/next when paginated).
 */
export function buildQuestBoardListComponents(
  list: Extract<QuestBoardListResult, { kind: "list" }>
): ActionRowBuilder[] {
  const rows: ActionRowBuilder[] = [];
  const select = new StringSelectMenuBuilder()
    .setCustomId(FORGE_QB_SELECT_CUSTOM_ID)
    .setPlaceholder("Choose a shop…")
    .addOptions(
      list.shops.map((s) => ({
        label: s.label,
        value: s.shopEntityIdStr,
      }))
    );
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));

  if (list.totalPages > 1) {
    const prev = new ButtonBuilder()
      .setCustomId(forgeQbPageCustomId(list.page - 1))
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(list.page <= 0);
    const next = new ButtonBuilder()
      .setCustomId(forgeQbPageCustomId(list.page + 1))
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(list.page >= list.totalPages - 1);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next));
  }

  return rows;
}

/**
 * Detail view: return to the summary list.
 */
export function buildQuestBoardDetailComponents(): ActionRowBuilder[] {
  const back = new ButtonBuilder()
    .setCustomId(FORGE_QB_BACK_CUSTOM_ID)
    .setLabel("Back to shop list")
    .setStyle(ButtonStyle.Primary);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(back)];
}
