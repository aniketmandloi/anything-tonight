import { z } from "zod";

import type { animeIdMap } from "@/db/schema";

export const FRIBB_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

export type AnimeIdMapRow = typeof animeIdMap.$inferInsert;

// Movie ids come as arrays; the few entries that span several TMDB movies keep the first.
const tmdbIds = z
  .union([z.number(), z.array(z.number())])
  .transform((v) => (Array.isArray(v) ? v[0] : v))
  .optional();

const fribbEntrySchema = z.object({
  anilist_id: z.number().optional(),
  mal_id: z.number().optional(),
  themoviedb_id: z.object({ tv: tmdbIds, movie: tmdbIds }).optional(),
  season: z.object({ tmdb: z.number().optional() }).optional(),
});

// Season 1 is the show's natural entry point; season 0 is TMDB's "specials".
function canonicalRank(season: number | null | undefined) {
  if (season === 1) return 0;
  if (season == null) return 1;
  return season > 0 ? 2 : 3;
}

export function parseFribb(data: unknown): AnimeIdMapRow[] {
  const rows: AnimeIdMapRow[] = [];
  for (const raw of z.array(z.unknown()).parse(data)) {
    const parsed = fribbEntrySchema.safeParse(raw);
    if (!parsed.success) continue;
    const { anilist_id, mal_id, themoviedb_id, season } = parsed.data;
    const tmdb = themoviedb_id?.tv
      ? { tmdbSource: "tmdb_tv" as const, tmdbId: String(themoviedb_id.tv) }
      : themoviedb_id?.movie
        ? { tmdbSource: "tmdb_movie" as const, tmdbId: String(themoviedb_id.movie) }
        : null;
    if (!anilist_id || !tmdb) continue;
    rows.push({
      anilistId: anilist_id,
      malId: mal_id ?? null,
      ...tmdb,
      tmdbSeason: season?.tmdb ?? null,
      canonical: false,
    });
  }

  const groups = new Map<string, AnimeIdMapRow[]>();
  for (const row of rows) {
    const key = `${row.tmdbSource}:${row.tmdbId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        canonicalRank(a.tmdbSeason) - canonicalRank(b.tmdbSeason) || a.anilistId - b.anilistId,
    );
    group[0].canonical = true;
  }
  return rows;
}
