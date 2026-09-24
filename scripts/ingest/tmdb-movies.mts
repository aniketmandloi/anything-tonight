// Loads movies from TMDB discover into the catalog.
// Usage: pnpm ingest:tmdb-movies [--pages 50] [--start-page 1] [--sort vote_count.desc] [--refresh]
// Titles already in the catalog are skipped unless --refresh, so an interrupted run resumes by re-running.
import { parseArgs } from "node:util";

import { db } from "@/db/client";
import { mapTmdbMovie } from "@/lib/catalog/tmdb-map";
import { findTitleId, upsertCatalogEntry } from "@/lib/catalog/upsert";
import { createTmdbClient } from "@/lib/tmdb/client";

const { values } = parseArgs({
  options: {
    pages: { type: "string", default: "50" },
    "start-page": { type: "string", default: "1" },
    sort: { type: "string", default: "vote_count.desc" },
    refresh: { type: "boolean", default: false },
  },
});

const token = process.env.TMDB_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");
const tmdb = createTmdbClient({ token });

const startPage = Number(values["start-page"]);
// TMDB discover stops at page 500.
const lastPage = Math.min(startPage + Number(values.pages) - 1, 500);
const counts = { upserted: 0, skipped: 0, failed: 0 };

try {
  for (let page = startPage; page <= lastPage; page++) {
    const { results, total_pages } = await tmdb.discover("movie", {
      sort_by: values.sort,
      page,
      include_adult: false,
      "vote_count.gte": 10,
    });

    await Promise.all(
      results.map(async ({ id }) => {
        if (!values.refresh && (await findTitleId(db, "tmdb_movie", String(id))) !== undefined) {
          counts.skipped++;
          return;
        }
        try {
          await upsertCatalogEntry(db, mapTmdbMovie(await tmdb.movie(id)));
          counts.upserted++;
        } catch (err) {
          counts.failed++;
          console.error(`movie ${id}:`, err instanceof Error ? err.message : err);
        }
      }),
    );

    console.log(`page ${page}/${lastPage}`, counts);
    if (page >= total_pages) break;
  }
} finally {
  await db.$client.end();
}

if (counts.failed > 0 && counts.upserted === 0) process.exitCode = 1;
