import type { QuestOfferReadPort, QuestOfferSnapshot } from "@forge/domain";

/** In-memory projection of subscribed `trade_order_state` rows (quest offers). */
export class QuestOfferCache implements QuestOfferReadPort {
  private readonly byKey = new Map<string, QuestOfferSnapshot>();

  has(questKey: string): boolean {
    return this.byKey.has(questKey);
  }

  upsert(row: QuestOfferSnapshot): void {
    this.byKey.set(row.questKey, row);
  }

  remove(questKey: string): void {
    this.byKey.delete(questKey);
  }

  values(): QuestOfferSnapshot[] {
    return [...this.byKey.values()];
  }

  /** Offers whose shop entity id matches a monitored building id in this guild. */
  snapshotForMonitoredBuildings(
    monitoredBuildingIds: Set<string>
  ): QuestOfferSnapshot[] {
    const out: QuestOfferSnapshot[] = [];
    for (const row of this.byKey.values()) {
      if (monitoredBuildingIds.has(row.shopEntityIdStr)) out.push(row);
    }
    return out;
  }
}
