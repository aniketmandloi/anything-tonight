CREATE TYPE "public"."external_source" AS ENUM('tmdb_movie', 'tmdb_tv', 'anilist', 'mal', 'imdb');--> statement-breakpoint
CREATE TABLE "title_external_ids" (
	"source" "external_source" NOT NULL,
	"external_id" text NOT NULL,
	"title_id" integer NOT NULL,
	CONSTRAINT "title_external_ids_source_external_id_pk" PRIMARY KEY("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "title_external_ids" ADD CONSTRAINT "title_external_ids_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "title_external_ids_title_id_idx" ON "title_external_ids" USING btree ("title_id");