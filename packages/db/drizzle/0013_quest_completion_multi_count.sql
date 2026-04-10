DROP INDEX "quest_completions_guild_forge_quest_subject_unq";--> statement-breakpoint
CREATE INDEX "quest_completions_guild_forge_idx" ON "quest_completions" USING btree ("discord_guild_id","forge_channel_id");
