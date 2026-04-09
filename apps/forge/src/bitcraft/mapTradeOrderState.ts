import type { TradeOrderState } from "@bitcraft/bindings";
import {
  formatItemStacks,
  type QuestOfferSnapshot,
  questKeyFromParts,
} from "@forge/domain";

export function mapTradeOrderToSnapshot(row: TradeOrderState): QuestOfferSnapshot {
  const offerLike = row.offerItems.map((s) => ({
    itemId: s.itemId,
    quantity: s.quantity,
  }));
  const reqLike = row.requiredItems.map((s) => ({
    itemId: s.itemId,
    quantity: s.quantity,
  }));
  const tid =
    row.travelerTradeOrderId === undefined ? null : row.travelerTradeOrderId;
  return {
    questKey: questKeyFromParts(row.shopEntityId, row.entityId),
    shopEntityIdStr: row.shopEntityId.toString(),
    orderEntityIdStr: row.entityId.toString(),
    remainingStock: row.remainingStock,
    offerSummary: formatItemStacks(offerLike),
    requiredSummary: formatItemStacks(reqLike),
    offerStacks: offerLike,
    requiredStacks: reqLike,
    travelerTradeOrderId: tid,
  };
}
