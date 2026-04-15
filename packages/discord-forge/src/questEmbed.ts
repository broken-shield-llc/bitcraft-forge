import { EmbedBuilder } from "discord.js";
import { type QuestOfferSnapshot } from "@forge/domain";

const EMBED_COLOR = 0x3498db;
const COMPLETION_EMBED_COLOR = 0x27ae60;
const TITLE_MAX = 256;

function buildQuestEmbedTitle(
  kind: "new" | "update",
  claimName: string,
  shopName: string
): string {
  const prefix = kind === "new" ? "Quest Added" : "Quest Updated";
  const claim = claimName.trim() || "—";
  const shop = shopName.trim() || "—";
  const title = `${prefix} in ${claim} - ${shop}`;
  if (title.length <= TITLE_MAX) return title;
  return title.slice(0, TITLE_MAX - 1) + "…";
}

export function buildQuestOfferEmbed(
  snapshot: QuestOfferSnapshot,
  options?: {
    kind?: "new" | "update";
    claimName?: string;
    shopNickname?: string;
    offerSummary?: string;
    requiredSummary?: string;
  }
): EmbedBuilder {
  const kind = options?.kind ?? "update";
  const claimDisplay = options?.claimName?.trim() || "—";
  const shopNick = options?.shopNickname?.trim();
  const shopDisplay = shopNick && shopNick.length > 0 ? shopNick : "—";
  const title = buildQuestEmbedTitle(kind, claimDisplay, shopDisplay);
  const offerSummary = options?.offerSummary ?? snapshot.offerSummary;
  const requiredSummary = options?.requiredSummary ?? snapshot.requiredSummary;

  return new EmbedBuilder()
    .setTitle(title)
    .setColor(EMBED_COLOR)
    .addFields(
      {
        name: "Offer",
        value: offerSummary.slice(0, 1024),
        inline: false,
      },
      {
        name: "Request",
        value: requiredSummary.slice(0, 1024),
        inline: false,
      },
      {
        name: "Stock",
        value: String(snapshot.remainingStock),
        inline: false,
      }
    )
    .setTimestamp(new Date());
}

export type QuestCompletionEmbedInput = {
  claimName?: string;
  shopNickname?: string;
  traderDisplay: string;
  offerSummary: string;
  requiredSummary: string;
  remainingStock?: number;
};

export function buildQuestCompletionEmbed(
  input: QuestCompletionEmbedInput
): EmbedBuilder {
  const claim = input.claimName?.trim() || "—";
  const building = input.shopNickname?.trim() || "—";
  let title = `${claim} - ${building}`;
  if (title.length > TITLE_MAX) title = title.slice(0, TITLE_MAX - 1) + "…";
  const fields = [
    {
      name: "Trader",
      value: input.traderDisplay.slice(0, 1024),
      inline: false,
    },
    {
      name: "Offer",
      value: input.offerSummary.slice(0, 1024),
      inline: false,
    },
    {
      name: "Request",
      value: input.requiredSummary.slice(0, 1024),
      inline: false,
    },
  ] as { name: string; value: string; inline: boolean }[];
  if (input.remainingStock !== undefined) {
    fields.push({
      name: "Stock",
      value: String(input.remainingStock),
      inline: false,
    });
  }
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(COMPLETION_EMBED_COLOR)
    .addFields(fields)
    .setTimestamp(new Date());
}
