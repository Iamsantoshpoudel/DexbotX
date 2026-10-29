CREATE TABLE "mod_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"target_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mod_actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX "mod_actions_guild_created_idx" ON "mod_actions" USING btree ("guild_id", "created_at");
