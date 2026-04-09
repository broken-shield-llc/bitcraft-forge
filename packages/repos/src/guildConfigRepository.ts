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

export type MonitoredBuildingScopePair = {
  discordGuildId: string;
  forgeChannelId: string;
  buildingId: string;
};

export interface GuildConfigRepository {
  isForgeChannelEnabled(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<boolean>;
  enableForgeChannel(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<AddResult>;
  disableForgeChannel(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<boolean>;

  addClaim(
    discordGuildId: string,
    forgeChannelId: string,
    claimId: string
  ): Promise<AddResult>;
  removeClaim(
    discordGuildId: string,
    forgeChannelId: string,
    claimId: string
  ): Promise<boolean>;
  listClaims(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<string[]>;

  addBuilding(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string,
    kind: BuildingKind,
    claimId?: string
  ): Promise<AddResult>;
  removeBuilding(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string
  ): Promise<boolean>;
  listBuildings(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<MonitoredBuildingRow[]>;

  setAnnouncementChannel(
    discordGuildId: string,
    forgeChannelId: string,
    channelId: string | null
  ): Promise<void>;
  getAnnouncementChannel(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<string | undefined>;

  listMonitoredBuildingScopePairs(): Promise<MonitoredBuildingScopePair[]>;
  isBuildingMonitored(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string
  ): Promise<boolean>;

  recordQuestCompletion(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string,
    questEntityId: string,
    subjectKey: string
  ): Promise<AddResult>;
  questLeaderboard(
    discordGuildId: string,
    forgeChannelId: string,
    limit: number
  ): Promise<QuestLeaderboardRow[]>;
}
