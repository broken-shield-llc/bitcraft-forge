import type { BuildingKind } from "@forge/domain";

export type AddResult = "ok" | "duplicate";

export type MonitoredBuildingRow = {
  buildingId: string;
  kind: BuildingKind;
  claimId?: string;
};

export type QuestLeaderboardRow = {
  /** `d:<discordUserId>` or `s:<stdbIdentityHex>`. */
  subjectKey: string;
  completions: number;
};

export type MonitoredBuildingGuildPair = {
  discordGuildId: string;
  buildingId: string;
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

  setAnnouncementChannel(
    discordGuildId: string,
    channelId: string | null
  ): Promise<void>;
  getAnnouncementChannel(
    discordGuildId: string
  ): Promise<string | undefined>;

  listMonitoredBuildingGuildPairs(): Promise<MonitoredBuildingGuildPair[]>;
  isBuildingMonitored(
    discordGuildId: string,
    buildingId: string
  ): Promise<boolean>;

  recordQuestCompletion(
    discordGuildId: string,
    buildingId: string,
    questEntityId: string,
    subjectKey: string
  ): Promise<AddResult>;
  questLeaderboard(
    discordGuildId: string,
    limit: number
  ): Promise<QuestLeaderboardRow[]>;
}
