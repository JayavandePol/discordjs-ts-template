CREATE TABLE `errors` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text NOT NULL,
	`severity` text DEFAULT 'error' NOT NULL,
	`context` text NOT NULL,
	`name` text,
	`message` text NOT NULL,
	`stack` text,
	`guild_id` text,
	`user_id` text,
	`command` text,
	`meta` text,
	`occurrences` integer DEFAULT 1 NOT NULL
);
