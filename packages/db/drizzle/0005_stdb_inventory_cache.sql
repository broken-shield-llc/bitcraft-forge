CREATE TABLE "stdb_inventory_cache" (
	"inventory_entity_id" text PRIMARY KEY NOT NULL,
	"owner_entity_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stdb_inventory_cache_owner_entity_id_idx" ON "stdb_inventory_cache" USING btree ("owner_entity_id");
