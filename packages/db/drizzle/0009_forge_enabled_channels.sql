CREATE TABLE "forge_enabled_channels" (
	"discord_guild_id" text NOT NULL,
	"discord_channel_id" text NOT NULL,
	"announcement_channel_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forge_enabled_channels_pk" PRIMARY KEY("discord_guild_id","discord_channel_id")
);
--> statement-breakpoint
ALTER TABLE "forge_enabled_channels" ADD CONSTRAINT "forge_enabled_channels_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "forge_enabled_channels" ("discord_guild_id", "discord_channel_id", "announcement_channel_id", "created_at")
SELECT "discord_guild_id", "announcement_channel_id", "announcement_channel_id", now()
FROM "discord_guilds"
WHERE "announcement_channel_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "monitored_claims" ADD COLUMN "forge_channel_id" text;
--> statement-breakpoint
ALTER TABLE "monitored_buildings" ADD COLUMN "forge_channel_id" text;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD COLUMN "forge_channel_id" text;
--> statement-breakpoint
UPDATE "monitored_claims" AS mc
SET "forge_channel_id" = dg."announcement_channel_id"
FROM "discord_guilds" AS dg
WHERE mc."discord_guild_id" = dg."discord_guild_id" AND dg."announcement_channel_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "monitored_buildings" AS mb
SET "forge_channel_id" = dg."announcement_channel_id"
FROM "discord_guilds" AS dg
WHERE mb."discord_guild_id" = dg."discord_guild_id" AND dg."announcement_channel_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "quest_completions" AS qc
SET "forge_channel_id" = dg."announcement_channel_id"
FROM "discord_guilds" AS dg
WHERE qc."discord_guild_id" = dg."discord_guild_id" AND dg."announcement_channel_id" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "quest_completions" WHERE "forge_channel_id" IS NULL;
--> statement-breakpoint
DELETE FROM "monitored_buildings" WHERE "forge_channel_id" IS NULL;
--> statement-breakpoint
DELETE FROM "monitored_claims" WHERE "forge_channel_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "monitored_claims" ALTER COLUMN "forge_channel_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "monitored_buildings" ALTER COLUMN "forge_channel_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quest_completions" ALTER COLUMN "forge_channel_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "monitored_claims_guild_claim_unq";
--> statement-breakpoint
DROP INDEX IF EXISTS "monitored_buildings_guild_building_unq";
--> statement-breakpoint
DROP INDEX IF EXISTS "quest_completions_guild_quest_subject_unq";
--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_claims_guild_forge_claim_unq" ON "monitored_claims" USING btree ("discord_guild_id","forge_channel_id","claim_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_buildings_guild_forge_building_unq" ON "monitored_buildings" USING btree ("discord_guild_id","forge_channel_id","building_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completions_guild_forge_quest_subject_unq" ON "quest_completions" USING btree ("discord_guild_id","forge_channel_id","quest_entity_id","subject_key");
--> statement-breakpoint
ALTER TABLE "monitored_claims" ADD CONSTRAINT "monitored_claims_forge_enabled_fk" FOREIGN KEY ("discord_guild_id","forge_channel_id") REFERENCES "public"."forge_enabled_channels"("discord_guild_id","discord_channel_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monitored_buildings" ADD CONSTRAINT "monitored_buildings_forge_enabled_fk" FOREIGN KEY ("discord_guild_id","forge_channel_id") REFERENCES "public"."forge_enabled_channels"("discord_guild_id","discord_channel_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_forge_enabled_fk" FOREIGN KEY ("discord_guild_id","forge_channel_id") REFERENCES "public"."forge_enabled_channels"("discord_guild_id","discord_channel_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "discord_guilds" DROP COLUMN "announcement_channel_id";
