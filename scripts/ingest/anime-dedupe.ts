// Folds AniList titles into their show's title using anime_id_map, then checks nothing is left twice.
// Usage: pnpm ingest:anime-dedupe  (run after ingest:anime-map)
import { db } from "@/db/client";
import { dedupeAnime, findDuplicateAnime } from "@/lib/catalog/anime-dedupe";

try {
  console.log("dedupe", await dedupeAnime(db));
  const remaining = await findDuplicateAnime(db);
  console.log(`shows with more than one title: ${remaining.length}`, remaining.slice(0, 10));
  if (remaining.length > 0) process.exitCode = 1;
} finally {
  await db.$client.end();
}
