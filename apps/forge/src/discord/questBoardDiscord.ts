import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type InteractionEditReplyOptions,
  StringSelectMenuBuilder,
} from "discord.js";
import type { QuestBoardListResult } from "@forge/application";

const EMBED_DESC_MAX = 4096;
const QUEST_BOARD_EMBED_COLOR = 0x2b2d31;

const QB_SEP = "|";

export type ParsedQuestBoardCustomId =
  | { type: "shop"; forgeChannelId: string }
  | { type: "back"; forgeChannelId: string }
  | { type: "page"; page: number; forgeChannelId: string };

export function forgeQbShopCustomId(forgeChannelId: string): string {
  return `forge_qb_shop${QB_SEP}${forgeChannelId}`;
}

export function forgeQbBackCustomId(forgeChannelId: string): string {
  return `forge_qb_back${QB_SEP}${forgeChannelId}`;
}

export function forgeQbPageCustomId(
  page: number,
  forgeChannelId: string
): string {
  return `forge_qb_page${QB_SEP}${page}${QB_SEP}${forgeChannelId}`;
}

export function parseForgeQuestBoardCustomId(
  customId: string
): ParsedQuestBoardCustomId | null {
  if (!customId.startsWith("forge_qb_")) return null;
  const parts = customId.split(QB_SEP);
  if (parts.length < 2) return null;
  const head = parts[0]!;
  if (head === "forge_qb_shop" && parts.length === 2) {
    return { type: "shop", forgeChannelId: parts[1]! };
  }
  if (head === "forge_qb_back" && parts.length === 2) {
    return { type: "back", forgeChannelId: parts[1]! };
  }
  if (head === "forge_qb_page" && parts.length === 3) {
    const page = Number(parts[1]);
    if (!Number.isFinite(page) || page < 0) return null;
    return {
      type: "page",
      page: Math.floor(page),
      forgeChannelId: parts[2]!,
    };
  }
  return null;
}

export function isForgeQuestBoardComponent(customId: string): boolean {
  return parseForgeQuestBoardCustomId(customId) !== null;
}

export function stripQuestBoardTitleLine(text: string): string {
  return text.replace(/^\*\*Quest board\*\*\s*\n?/u, "");
}

export type QuestBoardEmbedsResult = {
  content: string;
  embeds: EmbedBuilder[];
};

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
    body = body.slice(0, Math.max(0, EMBED_DESC_MAX - 1)) + "…";
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

export function buildQuestBoardListComponents(
  list: Extract<QuestBoardListResult, { kind: "list" }>,
  forgeChannelId: string
): ActionRowBuilder[] {
  const rows: ActionRowBuilder[] = [];
  const select = new StringSelectMenuBuilder()
    .setCustomId(forgeQbShopCustomId(forgeChannelId))
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
      .setCustomId(forgeQbPageCustomId(list.page - 1, forgeChannelId))
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(list.page <= 0);
    const next = new ButtonBuilder()
      .setCustomId(forgeQbPageCustomId(list.page + 1, forgeChannelId))
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(list.page >= list.totalPages - 1);
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next));
  }

  return rows;
}

export function buildQuestBoardDetailComponents(
  forgeChannelId: string
): ActionRowBuilder[] {
  const back = new ButtonBuilder()
    .setCustomId(forgeQbBackCustomId(forgeChannelId))
    .setLabel("Back to shop list")
    .setStyle(ButtonStyle.Primary);
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(back)];
}
