// Replaces anime_id_map with the latest Fribb/anime-lists AniList ↔ TMDB mapping.
// Usage: pnpm ingest:anime-map
import { db } from "@/db/client";
import { animeIdMap } from "@/db/schema";
import { FRIBB_URL, parseFribb } from "@/lib/catalog/anime-id-map";

const BATCH = 1000;

try {
  const res = await fetch(FRIBB_URL);
  if (!res.ok) throw new Error(`Fribb download failed: ${res.status}`);
  const rows = parseFribb(await res.json());

  await db.transaction(async (tx) => {
    await tx.delete(animeIdMap);
    for (let i = 0; i < rows.length; i += BATCH) {
      await tx.insert(animeIdMap).values(rows.slice(i, i + BATCH));
    }
  });
  console.log(`anime_id_map: ${rows.length} rows, ${rows.filter((r) => r.canonical).length} canonical`);
} finally {
  await db.$client.end();
}
