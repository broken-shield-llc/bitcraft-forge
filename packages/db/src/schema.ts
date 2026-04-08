import {
  pgTable,
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

export const monitoredClaims = pgTable(
  "monitored_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    claimId: text("claim_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    guildClaimUnq: uniqueIndex("monitored_claims_guild_claim_unq").on(
      t.discordGuildId,
      t.claimId
    ),
  })
);

export const monitoredBuildings = pgTable(
  "monitored_buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discordGuildId: text("discord_guild_id")
      .notNull()
      .references(() => discordGuilds.discordGuildId, { onDelete: "cascade" }),
    buildingId: text("building_id").notNull(),
    kind: text("kind").notNull(),
    claimId: text("claim_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    guildBuildingUnq: uniqueIndex("monitored_buildings_guild_building_unq").on(
      t.discordGuildId,
      t.buildingId
    ),
  })
);
