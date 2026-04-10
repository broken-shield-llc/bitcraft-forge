ALTER TABLE "discord_guilds" ADD COLUMN "announcement_channel_id" text;--> statement-breakpoint
CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_guild_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"building_id" text NOT NULL,
	"quest_entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_discord_guild_id_discord_guilds_discord_guild_id_fk" FOREIGN KEY ("discord_guild_id") REFERENCES "public"."discord_guilds"("discord_guild_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completions_guild_user_quest_unq" ON "quest_completions" USING btree ("discord_guild_id","discord_user_id","quest_entity_id");--> statement-breakpoint
CREATE INDEX "quest_completions_guild_created_idx" ON "quest_completions" USING btree ("discord_guild_id","created_at");
