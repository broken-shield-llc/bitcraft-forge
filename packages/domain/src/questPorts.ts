import type { QuestOfferSnapshot } from "./quest.js";

/** Read-only view of live quest offers (in-memory STDB projection in the forge app). */
export interface QuestOfferReadPort {
  snapshotForMonitoredBuildings(
    monitoredBuildingIds: Set<string>
  ): QuestOfferSnapshot[];
}
