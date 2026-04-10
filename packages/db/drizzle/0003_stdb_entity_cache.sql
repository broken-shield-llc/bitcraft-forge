CREATE TABLE "stdb_item_cache" (
	"item_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_claim_cache" (
	"claim_entity_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stdb_building_cache" (
	"building_entity_id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
