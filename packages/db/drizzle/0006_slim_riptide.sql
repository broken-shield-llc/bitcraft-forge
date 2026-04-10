CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"subject_key" text NOT NULL,
	"building_id" text NOT NULL,
	"quest_entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_building_cache" (
	"building_entity_id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "stdb_claim_cache" (
	"claim_entity_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
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
CREATE TABLE "stdb_item_cache" (
	"item_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_guilds" ADD COLUMN "announcement_channel_id" text;--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completions_guild_quest_subject_unq" ON "quest_completions" USING btree ("discord_guild_id","quest_entity_id","subject_key");--> statement-breakpoint
CREATE INDEX "stdb_inventory_cache_owner_entity_id_idx" ON "stdb_inventory_cache" USING btree ("owner_entity_id");