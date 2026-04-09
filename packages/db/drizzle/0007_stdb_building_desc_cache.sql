CREATE TABLE "stdb_building_desc_cache" (
	"building_description_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
