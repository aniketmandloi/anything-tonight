CREATE TABLE "title_relations" (
	"title_id" integer NOT NULL,
	"target_source" "external_source" NOT NULL,
	"target_external_id" text NOT NULL,
	"kind" text NOT NULL,
	"weight" real,
	CONSTRAINT "title_relations_title_id_target_source_target_external_id_kind_pk" PRIMARY KEY("title_id","target_source","target_external_id","kind")
);
--> statement-breakpoint
ALTER TABLE "title_relations" ADD CONSTRAINT "title_relations_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;