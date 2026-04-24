-- Traveler entity id at completion (BitCraft in-world id) for leaderboard when user_state cache is empty later
ALTER TABLE "quest_completions" ADD COLUMN IF NOT EXISTS "subject_traveler_entity_id" text;
