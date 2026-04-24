import type {
  BuildingKind,
  ItemStackLike,
  QuestLeaderboardScoringMode,
} from "@forge/domain";

export type AddResult = "ok" | "duplicate";

export type MonitoredBuildingRow = {
  buildingId: string;
  kind: BuildingKind;
  claimId?: string;
};

export type QuestLeaderboardRow = {
  /** `d:<discordUserId>` or `s:<stdbIdentityHex>`. */
  subjectKey: string;
  /** Sum of `leaderboard_points` for this subject in the scope. */
  points: number;
  /**
   * Name from the latest quest completion row for this subject (captured at completion time);
   * prefer over live cache for `s:` when set.
   */
  subjectDisplayName: string | null;
  /**
   * Traveler entity id from the latest relevant completion row (captured at completion time).
   */
  subjectTravelerEntityId: string | null;
};

export type RecordQuestCompletionInput = {
  discordGuildId: string;
  forgeChannelId: string;
  buildingId: string;
  questEntityId: string;
  subjectKey: string;
  offerStacks: ItemStackLike[];
  requireStacks: ItemStackLike[];
  leaderboardPoints: number;
  /** In-game (or other) name from the same resolution as the completion message; optional. */
  subjectDisplayName?: string | null;
  /** BitCraft traveler entity id from `user_state` at completion; optional. */
  subjectTravelerEntityId?: string | null;
};

export type QuestScoringConfigView = {
  mode: QuestLeaderboardScoringMode;
  weights: Record<string, number>;
};

export type MonitoredBuildingScopePair = {
  discordGuildId: string;
  forgeChannelId: string;
  buildingId: string;
};

/** Which quest Discord embed stream (routing picks column + fallback to default). */
export type QuestAnnouncementKind = "new" | "update" | "completion";

/** Which DB column was used for the resolved announcement target. */
export type QuestAnnouncementRoutingSource =
  | "default"
  | "quest_added"
  | "quest_updated"
  | "quest_completion";

export type QuestAnnouncementRouting = {
  channelId: string;
  source: QuestAnnouncementRoutingSource;
};

export type QuestAnnouncementOverrideTarget =
  | "quest_added"
  | "quest_updated"
  | "quest_completion";

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
  /**
   * Per-kind override; null clears that column. Falls back to {@link setAnnouncementChannel} default in routing.
   */
  setQuestAnnouncementOverride(
    discordGuildId: string,
    forgeChannelId: string,
    target: QuestAnnouncementOverrideTarget,
    channelId: string | null
  ): Promise<void>;
  /**
   * Resolves where to post for this kind: override column if set, else `announcementChannelId`.
   * Returns undefined if both are unset (paused for that stream).
   */
  getQuestAnnouncementRouting(
    discordGuildId: string,
    forgeChannelId: string,
    kind: QuestAnnouncementKind
  ): Promise<QuestAnnouncementRouting | undefined>;
  /** Clears the DB column that supplied this routing (e.g. after Discord 50001/10003/50013). */
  clearQuestAnnouncementRouting(
    discordGuildId: string,
    forgeChannelId: string,
    source: QuestAnnouncementRoutingSource
  ): Promise<void>;

  listMonitoredBuildingScopePairs(): Promise<MonitoredBuildingScopePair[]>;
  isBuildingMonitored(
    discordGuildId: string,
    forgeChannelId: string,
    buildingId: string
  ): Promise<boolean>;

  recordQuestCompletion(input: RecordQuestCompletionInput): Promise<AddResult>;

  getQuestScoringConfig(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<QuestScoringConfigView | null>;

  /**
   * Persists scoring mode + merged weights, then recomputes `leaderboard_points` for all completions in the scope.
   */
  setQuestScoringConfig(
    discordGuildId: string,
    forgeChannelId: string,
    input: {
      mode: QuestLeaderboardScoringMode;
      weightsPatch?: Partial<Record<string, number>> | null;
    },
    getTiers: (itemIds: number[]) => Promise<Map<number, number | null>>
  ): Promise<number>;

  /**
   * @param limit Max rows, or `null` for all subjects that have at least one completion (ordered by total points).
   */
  questLeaderboard(
    discordGuildId: string,
    forgeChannelId: string,
    limit: number | null
  ): Promise<QuestLeaderboardRow[]>;
  /** Deletes all quest completion rows for this guild + forge channel scope. */
  clearQuestCompletionsForScope(
    discordGuildId: string,
    forgeChannelId: string
  ): Promise<number>;
}
