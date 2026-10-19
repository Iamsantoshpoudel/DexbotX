ALTER TABLE "guilds" RENAME COLUMN "id" TO "guild_id";
--> statement-breakpoint
ALTER TABLE "guilds" RENAME COLUMN "icon_hash" TO "icon";
--> statement-breakpoint
ALTER TABLE "guilds" RENAME COLUMN "installed" TO "bot_present";
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "last_synced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "guild_settings" DROP CONSTRAINT "guild_settings_guild_id_guilds_id_fk";
--> statement-breakpoint
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE TABLE "guild_channels" (
	"guild_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"type" integer NOT NULL,
	"parent_id" text,
	"position" integer NOT NULL,
	CONSTRAINT "guild_channels_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
ALTER TABLE "guild_channels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guild_channels" ADD CONSTRAINT "guild_channels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "guild_channels_guild_type_idx" ON "guild_channels" USING btree ("guild_id","type");
--> statement-breakpoint
CREATE TABLE "guild_roles" (
	"guild_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"color" integer DEFAULT 0 NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "guild_roles_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
ALTER TABLE "guild_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guild_roles" ADD CONSTRAINT "guild_roles_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "guild_roles_guild_position_idx" ON "guild_roles" USING btree ("guild_id","position");
--> statement-breakpoint
CREATE TABLE "guild_templates" (
	"guild_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_templates_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
ALTER TABLE "guild_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guild_templates" ADD CONSTRAINT "guild_templates_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("guild_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "guild_templates_guild_idx" ON "guild_templates" USING btree ("guild_id");
