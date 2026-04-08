import type { BuildingKind } from "@forge/domain";

export type AddResult = "ok" | "duplicate";

export type MonitoredBuildingRow = {
  buildingId: string;
  kind: BuildingKind;
  claimId?: string;
};

export interface GuildConfigRepository {
  addClaim(discordGuildId: string, claimId: string): Promise<AddResult>;
  removeClaim(discordGuildId: string, claimId: string): Promise<boolean>;
  listClaims(discordGuildId: string): Promise<string[]>;

  addBuilding(
    discordGuildId: string,
    buildingId: string,
    kind: BuildingKind,
    claimId?: string
  ): Promise<AddResult>;
  removeBuilding(
    discordGuildId: string,
    buildingId: string
  ): Promise<boolean>;
  listBuildings(discordGuildId: string): Promise<MonitoredBuildingRow[]>;
}
