import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const discordGuilds = pgTable("discord_guilds", {
  id: uuid("id").defaultRandom().primaryKey(),
  discordGuildId: text("discord_guild_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * A Discord channel where `/forge enable` was run: own monitors, leaderboard, and announcements.
 * `announcementChannelId` is the default target for quest embeds when per-kind overrides are unset.
 * Per-kind columns override only that stream; all null + default null means paused.
 */
export const forgeEnabledChannels = pgTable(
  "forge_enabled_channels",
  {
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    discordChannelId: text("discord_channel_id").notNull(),
    announcementChannelId: text("announcement_channel_id"),
    questAddedChannelId: text("quest_added_channel_id"),
    questUpdatedChannelId: text("quest_updated_channel_id"),
    questCompletionChannelId: text("quest_completion_channel_id"),
    questLeaderboardScoringMode: text("quest_leaderboard_scoring_mode")
      .notNull()
      .default("default"),
    questScoringWeights: jsonb("quest_scoring_weights").$type<
      Record<string, number> | null
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.discordGuildId, t.discordChannelId] }),
  })
);

export const monitoredClaims = pgTable(
  "monitored_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    forgeChannelId: text("forge_channel_id").notNull(),
    claimId: text("claim_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    guildForgeClaimUnq: uniqueIndex("monitored_claims_guild_forge_claim_unq").on(
      t.discordGuildId,
      t.forgeChannelId,
      t.claimId
    ),
    forgeFk: foreignKey({
      columns: [t.discordGuildId, t.forgeChannelId],
      foreignColumns: [
        forgeEnabledChannels.discordGuildId,
        forgeEnabledChannels.discordChannelId,
      ],
    }).onDelete("cascade"),
  })
);

export const monitoredBuildings = pgTable(
  "monitored_buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    forgeChannelId: text("forge_channel_id").notNull(),
    buildingId: text("building_id").notNull(),
    kind: text("kind").notNull(),
    claimId: text("claim_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    guildForgeBuildingUnq: uniqueIndex(
      "monitored_buildings_guild_forge_building_unq"
    ).on(t.discordGuildId, t.forgeChannelId, t.buildingId),
    forgeFk: foreignKey({
      columns: [t.discordGuildId, t.forgeChannelId],
      foreignColumns: [
        forgeEnabledChannels.discordGuildId,
        forgeEnabledChannels.discordChannelId,
      ],
    }).onDelete("cascade"),
  })
);

export const questCompletions = pgTable(
  "quest_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    forgeChannelId: text("forge_channel_id").notNull(),
    /** `d:<discordUserId>` for manual logs; `s:<identityHex>` from STDB barter accept. */
    subjectKey: text("subject_key").notNull(),
    /** In-game (or other) name captured at completion; leaderboard uses when live name cache is empty. */
    subjectDisplayName: text("subject_display_name"),
    /**
     * BitCraft traveler `entityId` from cached `user_state` at completion time;
     * used for shorter leaderboard display when the live `user_state` row is missing later.
     */
    subjectTravelerEntityId: text("subject_traveler_entity_id"),
    buildingId: text("building_id").notNull(),
    questEntityId: text("quest_entity_id").notNull(),
    offerStacks: jsonb("offer_stacks")
      .notNull()
      .$type<Array<{ itemId: number; quantity: number }>>()
      .default([]),
    requireStacks: jsonb("require_stacks")
      .notNull()
      .$type<Array<{ itemId: number; quantity: number }>>()
      .default([]),
    leaderboardPoints: integer("leaderboard_points").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    guildForgeIdx: index("quest_completions_guild_forge_idx").on(
      t.discordGuildId,
      t.forgeChannelId
    ),
    forgeFk: foreignKey({
      columns: [t.discordGuildId, t.forgeChannelId],
      foreignColumns: [
        forgeEnabledChannels.discordGuildId,
        forgeEnabledChannels.discordChannelId,
      ],
    }).onDelete("cascade"),
  })
);

export const stdbItemCache = pgTable("stdb_item_cache", {
  itemId: integer("item_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stdbClaimCache = pgTable("stdb_claim_cache", {
  claimEntityId: text("claim_entity_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stdbBuildingCache = pgTable("stdb_building_cache", {
  buildingEntityId: text("building_entity_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stdbBuildingDescCache = pgTable("stdb_building_desc_cache", {
  buildingDescriptionId: integer("building_description_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stdbBuildingNicknameCache = pgTable("stdb_building_nickname_cache", {
  buildingEntityId: text("building_entity_id").primaryKey(),
  nickname: text("nickname").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stdbInventoryCache = pgTable(
  "stdb_inventory_cache",
  {
    inventoryEntityId: text("inventory_entity_id").primaryKey(),
    ownerEntityId: text("owner_entity_id").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    cachedAt: timestamp("cached_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    ownerIdx: index("stdb_inventory_cache_owner_entity_id_idx").on(
      t.ownerEntityId
    ),
  })
);

export const stdbUserStateCache = pgTable("stdb_user_state_cache", {
  identityHex: text("identity_hex").primaryKey(),
  travelerEntityId: text("traveler_entity_id").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const stdbPlayerUsernameCache = pgTable("stdb_player_username_cache", {
  travelerEntityId: text("traveler_entity_id").primaryKey(),
  username: text("username").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
