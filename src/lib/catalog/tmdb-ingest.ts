import type { db as Db } from "@/db/client";
import type { MediaType, TmdbClient } from "@/lib/tmdb/client";

import { upsertWithAnimeMapping } from "./anime-link";
import { mapTmdbMovie, mapTmdbTv } from "./tmdb-map";
import type { IngestCounts } from "./types";
import { findTitleId } from "./upsert";

// Fetches, maps and upserts one TMDB title; returns false if it failed.
export async function ingestTmdbTitle(
  db: typeof Db,
  tmdb: TmdbClient,
  type: MediaType,
  id: number,
): Promise<boolean> {
  try {
    const entry = type === "movie" ? mapTmdbMovie(await tmdb.movie(id)) : mapTmdbTv(await tmdb.tv(id));
    await upsertWithAnimeMapping(db, entry);
    return true;
  } catch (err) {
    console.error(`${type} ${id}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// Walks TMDB discover pages. Titles already stored are skipped unless `refresh`,
// so an interrupted run resumes by running it again.
export async function ingestTmdbDiscover(
  db: typeof Db,
  tmdb: TmdbClient,
  opts: { type: MediaType; startPage: number; pages: number; sort: string; refresh: boolean },
): Promise<IngestCounts> {
  const source = opts.type === "movie" ? "tmdb_movie" : "tmdb_tv";
  // TMDB discover stops at page 500.
  const lastPage = Math.min(opts.startPage + opts.pages - 1, 500);
  const counts: IngestCounts = { upserted: 0, aliased: 0, skipped: 0, failed: 0 };

  for (let page = opts.startPage; page <= lastPage; page++) {
    const { results, total_pages } = await tmdb.discover(opts.type, {
      sort_by: opts.sort,
      page,
      include_adult: false,
      "vote_count.gte": 10,
    });

    await Promise.all(
      results.map(async ({ id }) => {
        if (!opts.refresh && (await findTitleId(db, source, String(id))) !== undefined) {
          counts.skipped++;
        } else if (await ingestTmdbTitle(db, tmdb, opts.type, id)) {
          counts.upserted++;
        } else {
          counts.failed++;
        }
      }),
    );

    console.log(`${opts.type} page ${page}/${lastPage}`, counts);
    if (page >= total_pages) break;
  }
  return counts;
}
