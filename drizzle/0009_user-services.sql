CREATE TABLE "user_services" (
	"user_id" text NOT NULL,
	"region" text NOT NULL,
	"provider_id" integer NOT NULL,
	CONSTRAINT "user_services_user_id_region_provider_id_pk" PRIMARY KEY("user_id","region","provider_id")
);
