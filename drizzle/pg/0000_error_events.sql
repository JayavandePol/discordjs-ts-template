CREATE TABLE "error_events" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"context" text NOT NULL,
	"name" text,
	"message" text NOT NULL,
	"stack" text,
	"guild_id" text,
	"user_id" text,
	"channel_id" text,
	"command" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE INDEX "error_events_fingerprint_idx" ON "error_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_events_created_at_idx" ON "error_events" USING btree ("created_at");