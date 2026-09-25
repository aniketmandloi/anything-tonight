CREATE TYPE "public"."user_title_status" AS ENUM('watched', 'watching', 'want', 'dismissed');--> statement-breakpoint
CREATE TABLE "user_titles" (
	"user_id" text NOT NULL,
	"title_id" integer NOT NULL,
	"status" "user_title_status" NOT NULL,
	"rating" smallint,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_titles_user_id_title_id_pk" PRIMARY KEY("user_id","title_id"),
	CONSTRAINT "user_titles_rating_range" CHECK ("user_titles"."rating" between -2 and 2)
);
--> statement-breakpoint
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_titles_title_id_idx" ON "user_titles" USING btree ("title_id");