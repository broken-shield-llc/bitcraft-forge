CREATE TABLE "discord_guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discord_guilds_discord_guild_id_unique" UNIQUE("discord_guild_id")
);
--> statement-breakpoint
CREATE TABLE "monitored_buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"building_id" text NOT NULL,
	"kind" text NOT NULL,
	"claim_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitored_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitored_buildings" ADD CONSTRAINT "monitored_buildings_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_claims" ADD CONSTRAINT "monitored_claims_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_buildings_guild_building_unq" ON "monitored_buildings" USING btree ("discord_guild_id","building_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_claims_guild_claim_unq" ON "monitored_claims" USING btree ("discord_guild_id","claim_id");