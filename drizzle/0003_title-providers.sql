CREATE TYPE "public"."monetization" AS ENUM('flatrate', 'free', 'ads', 'rent', 'buy');--> statement-breakpoint
CREATE TABLE "title_providers" (
	"title_id" integer NOT NULL,
	"region" text NOT NULL,
	"provider_id" integer NOT NULL,
	"provider_name" text NOT NULL,
	"logo_path" text,
	"monetization" "monetization" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_providers_title_id_region_provider_id_monetization_pk" PRIMARY KEY("title_id","region","provider_id","monetization")
);
--> statement-breakpoint
ALTER TABLE "title_providers" ADD CONSTRAINT "title_providers_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "title_providers_region_provider_idx" ON "title_providers" USING btree ("region","provider_id");