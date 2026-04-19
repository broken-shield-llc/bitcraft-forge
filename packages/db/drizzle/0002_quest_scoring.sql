-- Quest leaderboard scoring: mode + tier weights on each forge scope; completion offer/require snapshots + points.
-- Baselines every existing scope to Default mode, uniform 1-point tier weights, and normalizes completion points.
ALTER TABLE "forge_enabled_channels" ADD COLUMN "quest_leaderboard_scoring_mode" text NOT NULL DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE "forge_enabled_channels" ADD COLUMN "quest_scoring_weights" jsonb;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD COLUMN "offer_stacks" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD COLUMN "require_stacks" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD COLUMN "leaderboard_points" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "forge_enabled_channels" SET "quest_leaderboard_scoring_mode" = 'default';
--> statement-breakpoint
UPDATE "forge_enabled_channels" SET "quest_scoring_weights" = '{"untiered":1,"1":1,"2":1,"3":1,"4":1,"5":1,"6":1,"7":1,"8":1,"9":1,"10":1}'::jsonb;
--> statement-breakpoint
UPDATE "quest_completions" SET "leaderboard_points" = 1;
