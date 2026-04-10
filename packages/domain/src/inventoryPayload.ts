/**
 * Sum item quantities from a cached `inventory_state` JSON payload (`pockets[].contents`).
 */
export function aggregateItemTotalsFromInventoryPayload(
  payload: Record<string, unknown>
): Map<number, number> {
  const totals = new Map<number, number>();
  const pockets = payload.pockets;
  if (!Array.isArray(pockets)) return totals;
  for (const p of pockets) {
    if (!p || typeof p !== "object") continue;
    const contents = (p as { contents?: { itemId?: unknown; quantity?: unknown } })
      .contents;
    if (!contents || typeof contents !== "object") continue;
    const itemId = Number((contents as { itemId?: unknown }).itemId);
    if (!Number.isFinite(itemId)) continue;
    const quantity = Math.max(
      0,
      Math.floor(Number((contents as { quantity?: unknown }).quantity) || 0)
    );
    totals.set(itemId, (totals.get(itemId) ?? 0) + quantity);
  }
  return totals;
}
