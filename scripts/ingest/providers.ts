// Refreshes watch providers for catalog titles that have a TMDB id.
// Usage: pnpm ingest:providers [--limit N]
import { parseArgs } from "node:util";

import { inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { titleExternalIds } from "@/db/schema";
import { mapProviders, replaceTitleProviders } from "@/lib/catalog/providers";
import { createTmdbClient } from "@/lib/tmdb/client";

const { values } = parseArgs({ options: { limit: { type: "string" } } });

const token = process.env.TMDB_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");
const tmdb = createTmdbClient({ token });

const CHUNK = 20;
const counts = { titles: 0, rows: 0, failed: 0 };

try {
  const query = db
    .select()
    .from(titleExternalIds)
    .where(inArray(titleExternalIds.source, ["tmdb_movie", "tmdb_tv"]))
    .orderBy(titleExternalIds.titleId);
  const refs = values.limit ? await query.limit(Number(values.limit)) : await query;

  for (let i = 0; i < refs.length; i += CHUNK) {
    await Promise.all(
      refs.slice(i, i + CHUNK).map(async ({ source, externalId, titleId }) => {
        try {
          const wp = await tmdb.watchProviders(source === "tmdb_movie" ? "movie" : "tv", Number(externalId));
          const rows = mapProviders(wp);
          await replaceTitleProviders(db, titleId, rows);
          counts.titles++;
          counts.rows += rows.length;
        } catch (err) {
          counts.failed++;
          console.error(`${source} ${externalId}:`, err instanceof Error ? err.message : err);
        }
      }),
    );
    console.log(`providers ${Math.min(i + CHUNK, refs.length)}/${refs.length}`, counts);
  }
  if (counts.failed > 0 && counts.titles === 0) process.exitCode = 1;
} finally {
  await db.$client.end();
}
