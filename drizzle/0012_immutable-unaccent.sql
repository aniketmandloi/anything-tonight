CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
-- unaccent() is only STABLE (its dictionary can change), so indexes need an IMMUTABLE wrapper
-- that pins the dictionary.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;
