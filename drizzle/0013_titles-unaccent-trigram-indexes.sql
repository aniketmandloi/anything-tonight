DROP INDEX "titles_title_trgm_idx";--> statement-breakpoint
DROP INDEX "titles_original_title_trgm_idx";--> statement-breakpoint
CREATE INDEX "titles_title_trgm_idx" ON "titles" USING gin (f_unaccent("title") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "titles_original_title_trgm_idx" ON "titles" USING gin (f_unaccent("original_title") gin_trgm_ops);