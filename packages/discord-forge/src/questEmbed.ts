import { EmbedBuilder } from "discord.js";
import type { QuestOfferSnapshot } from "@forge/domain";

const EMBED_COLOR = 0x3498db;
/** Discord embed title max length */
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
