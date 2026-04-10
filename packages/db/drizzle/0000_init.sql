CREATE TABLE "discord_guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_guilds_discord_guild_id_unique" UNIQUE("discord_guild_id")
);
--> statement-breakpoint
CREATE TABLE "forge_enabled_channels" (
	"discord_guild_id" text NOT NULL,
	"discord_channel_id" text NOT NULL,
	"announcement_channel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forge_enabled_channels_discord_guild_id_discord_channel_id_pk" PRIMARY KEY("discord_guild_id","discord_channel_id")
);
--> statement-breakpoint
CREATE TABLE "monitored_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"forge_channel_id" text NOT NULL,
	"building_id" text NOT NULL,
	"kind" text NOT NULL,
	"claim_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitored_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"forge_channel_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"forge_channel_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"building_id" text NOT NULL,
	"quest_entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_item_cache" (
	"item_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_claim_cache" (
	"claim_entity_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_building_cache" (
	"building_entity_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_building_desc_cache" (
	"building_description_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_building_nickname_cache" (
	"building_entity_id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_inventory_cache" (
	"inventory_entity_id" text PRIMARY KEY NOT NULL,
	"owner_entity_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_user_state_cache" (
	"identity_hex" text PRIMARY KEY NOT NULL,
	"traveler_entity_id" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_player_username_cache" (
	"traveler_entity_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forge_enabled_channels" ADD CONSTRAINT "forge_enabled_channels_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_claims" ADD CONSTRAINT "monitored_claims_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_claims" ADD CONSTRAINT "monitored_claims_discord_guild_id_forge_channel_id_forge_enabled_channels_discord_guild_id_discord_channel_id_fk" FOREIGN KEY ("discord_guild_id","forge_channel_id") REFERENCES "public"."forge_enabled_channels"("discord_guild_id","discord_channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_buildings" ADD CONSTRAINT "monitored_buildings_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_buildings" ADD CONSTRAINT "monitored_buildings_discord_guild_id_forge_channel_id_forge_enabled_channels_discord_guild_id_discord_channel_id_fk" FOREIGN KEY ("discord_guild_id","forge_channel_id") REFERENCES "public"."forge_enabled_channels"("discord_guild_id","discord_channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_discord_guild_id_forge_channel_id_forge_enabled_channels_discord_guild_id_discord_channel_id_fk" FOREIGN KEY ("discord_guild_id","forge_channel_id") REFERENCES "public"."forge_enabled_channels"("discord_guild_id","discord_channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_claims_guild_forge_claim_unq" ON "monitored_claims" USING btree ("discord_guild_id","forge_channel_id","claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_buildings_guild_forge_building_unq" ON "monitored_buildings" USING btree ("discord_guild_id","forge_channel_id","building_id");--> statement-breakpoint
CREATE INDEX "quest_completions_guild_forge_idx" ON "quest_completions" USING btree ("discord_guild_id","forge_channel_id");--> statement-breakpoint
CREATE INDEX "stdb_inventory_cache_owner_entity_id_idx" ON "stdb_inventory_cache" USING btree ("owner_entity_id");