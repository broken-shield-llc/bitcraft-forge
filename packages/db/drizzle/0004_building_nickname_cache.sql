CREATE TABLE "stdb_building_nickname_cache" (
	"building_entity_id" text PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
