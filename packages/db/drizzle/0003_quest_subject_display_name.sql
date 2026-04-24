-- Snapshot name at completion time (reliable in leaderboard even if STDB name cache lags)
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "subject_display_name" text;
