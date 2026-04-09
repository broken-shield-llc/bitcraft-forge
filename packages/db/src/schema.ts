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
 * `announcementChannelId` null means quest/barter embeds are paused (`/forge channel set` cleared).
 */
export const forgeEnabledChannels = pgTable(
  "forge_enabled_channels",
  {
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    discordChannelId: text("discord_channel_id").notNull(),
    announcementChannelId: text("announcement_channel_id"),
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
    buildingId: text("building_id").notNull(),
    questEntityId: text("quest_entity_id").notNull(),
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

/** Cached `item_desc` row snapshot from SpacetimeDB (refreshed after TTL). */
export const stdbItemCache = pgTable("stdb_item_cache", {
  itemId: integer("item_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Cached `claim_state` row snapshot (key = claim `entityId` as decimal string). */
export const stdbClaimCache = pgTable("stdb_claim_cache", {
  claimEntityId: text("claim_entity_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Cached `building_state` row snapshot (key = building `entityId` as decimal string). */
export const stdbBuildingCache = pgTable("stdb_building_cache", {
  buildingEntityId: text("building_entity_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Cached `building_desc` row (key = `id` referenced by `building_state.building_description_id`). */
export const stdbBuildingDescCache = pgTable("stdb_building_desc_cache", {
  buildingDescriptionId: integer("building_description_id").primaryKey(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Cached `building_nickname_state` (player-set nickname for display). */
export const stdbBuildingNicknameCache = pgTable("stdb_building_nickname_cache", {
  buildingEntityId: text("building_entity_id").primaryKey(),
  nickname: text("nickname").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Cached `inventory_state` rows (key = inventory `entityId` as decimal string). */
export const stdbInventoryCache = pgTable(
  "stdb_inventory_cache",
  {
    inventoryEntityId: text("inventory_entity_id").primaryKey(),
    /** `ownerEntityId` for aggregating all inventories belonging to a shop building. */
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

/** Cached `user_state`: SpacetimeDB identity hex → traveler `entityId` string. */
export const stdbUserStateCache = pgTable("stdb_user_state_cache", {
  identityHex: text("identity_hex").primaryKey(),
  travelerEntityId: text("traveler_entity_id").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Cached `player_username_state`: traveler `entityId` → in-game username. */
export const stdbPlayerUsernameCache = pgTable("stdb_player_username_cache", {
  travelerEntityId: text("traveler_entity_id").primaryKey(),
  username: text("username").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
