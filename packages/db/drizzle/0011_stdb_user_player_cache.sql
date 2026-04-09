CREATE TABLE "stdb_user_state_cache" (
	"identity_hex" text PRIMARY KEY NOT NULL,
	"traveler_entity_id" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_player_username_cache" (
	"traveler_entity_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
