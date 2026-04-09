import type { QuestOfferSnapshot } from "./quest.js";

/**
 * Read-only view of live quest offers (e.g. in-memory STDB projection).
 * Implemented by `QuestOfferCache` in the forge app.
 */
export interface QuestOfferReadPort {
  snapshotForMonitoredBuildings(
    monitoredBuildingIds: Set<string>
  ): QuestOfferSnapshot[];
}
