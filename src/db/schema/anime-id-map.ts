import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { externalSource } from "./title-external-ids";

// AniList ↔ TMDB mapping from the community Fribb/anime-lists dataset.
// AniList has one entry per season/special while TMDB has one per show, so several AniList
// ids point at the same TMDB id; exactly one of them is `canonical` and supplies the title's
// AniList-owned fields, the rest are aliases.
export const animeIdMap = pgTable(
  "anime_id_map",
  {
    anilistId: integer("anilist_id").primaryKey(),
    malId: integer("mal_id"),
    tmdbSource: externalSource("tmdb_source").notNull(),
    tmdbId: text("tmdb_id").notNull(),
    tmdbSeason: integer("tmdb_season"),
    canonical: boolean().notNull(),
  },
  (t) => [index("anime_id_map_tmdb_idx").on(t.tmdbSource, t.tmdbId)],
);
