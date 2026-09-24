CREATE TABLE "anime_id_map" (
	"anilist_id" integer PRIMARY KEY NOT NULL,
	"mal_id" integer,
	"tmdb_source" "external_source" NOT NULL,
	"tmdb_id" text NOT NULL,
	"tmdb_season" integer,
	"canonical" boolean NOT NULL
);
--> statement-breakpoint
CREATE INDEX "anime_id_map_tmdb_idx" ON "anime_id_map" USING btree ("tmdb_source","tmdb_id");