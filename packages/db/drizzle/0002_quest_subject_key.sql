ALTER TABLE "quest_completions" ADD COLUMN "subject_key" text;--> statement-breakpoint
UPDATE "quest_completions" SET "subject_key" = 'd:' || "discord_user_id" WHERE "subject_key" IS NULL;--> statement-breakpoint
ALTER TABLE "quest_completions" ALTER COLUMN "subject_key" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "quest_completions_guild_user_quest_unq";--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completions_guild_quest_subject_unq" ON "quest_completions" USING btree ("discord_guild_id","quest_entity_id","subject_key");--> statement-breakpoint
ALTER TABLE "quest_completions" DROP COLUMN "discord_user_id";
