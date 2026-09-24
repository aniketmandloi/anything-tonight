CREATE TYPE "public"."title_type" AS ENUM('movie', 'tv', 'anime');--> statement-breakpoint
CREATE TABLE "titles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "titles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "title_type" NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"overview" text,
	"year" integer,
	"runtime" integer,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"original_language" text,
	"maturity" text,
	"poster_path" text,
	"backdrop_path" text,
	"vote_avg" real,
	"vote_count" integer,
	"popularity" real,
	"embedding" vector(1536),
	"mood" vector(8),
	"quality" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "titles_embedding_idx" ON "titles" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "titles_type_popularity_idx" ON "titles" USING btree ("type","popularity");