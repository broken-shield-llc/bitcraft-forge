import type { ItemStackLike, QuestOfferSnapshot } from "./quest.js";

/**
 * Whether the stall can pay out the **offer** side for one trade,
 * given aggregated item quantities in that building's inventories.
 */
export function canStallFulfillOfferOnce(
  offerStacks: ItemStackLike[],
  inventoryTotalsByItemId: ReadonlyMap<number, number>
): boolean {
  for (const stack of offerStacks) {
    const have = inventoryTotalsByItemId.get(stack.itemId) ?? 0;
    if (have < stack.quantity) return false;
  }
  return true;
}

/** Source of aggregated `inventory_state` for a shop (`ownerEntityId`). */
export type StallInventoryBoardPort = {
  /** True if we have seen at least one `inventory_state` row for this owner. */
  hasInventoryDataForOwner(ownerEntityIdStr: string): boolean;
  /** Totals across that owner's inventories (all pockets); empty if none. */
  getTotalsForOwner(ownerEntityIdStr: string): ReadonlyMap<number, number>;
};

/**
 * Quest board visibility: hide zero stock, and hide offers the stall cannot
 * fulfill once when inventory data exists for that shop.
 * If we have no `inventory_state` rows for the shop yet, the offer is shown.
 */
export function isQuestOfferVisibleOnBoard(
  snap: QuestOfferSnapshot,
  inventory: StallInventoryBoardPort
): boolean {
  if (snap.remainingStock <= 0) return false;
  if (!inventory.hasInventoryDataForOwner(snap.shopEntityIdStr)) return true;
  const totals = inventory.getTotalsForOwner(snap.shopEntityIdStr);
  return canStallFulfillOfferOnce(snap.offerStacks ?? [], totals);
}
