ALTER TABLE "forge_enabled_channels" ADD COLUMN "quest_added_channel_id" text;
--> statement-breakpoint
ALTER TABLE "forge_enabled_channels" ADD COLUMN "quest_updated_channel_id" text;
--> statement-breakpoint
ALTER TABLE "forge_enabled_channels" ADD COLUMN "quest_completion_channel_id" text;
