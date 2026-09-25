// Recomputes titles.quality for the whole catalog; pool stats shift as titles are added.
// Usage: pnpm enrich:quality
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { titleExternalIds, titles } from "@/db/schema";
import { computeQuality } from "@/engine/quality";

const CHUNK = 1000;

try {
  const rows = await db
    .select({
      id: titles.id,
      type: titles.type,
      voteAvg: titles.voteAvg,
      voteCount: titles.voteCount,
      // TMDB owns votes on titles it describes (see anime-merge.ts); the rest are AniList's.
      hasTmdb: sql<boolean>`exists (
        select 1 from ${titleExternalIds}
        where ${titleExternalIds.titleId} = ${titles.id}
          and ${titleExternalIds.source} in ('tmdb_movie', 'tmdb_tv')
      )`,
    })
    .from(titles);

  const scores = [
    ...computeQuality(rows.map((r) => ({ ...r, pool: `${r.type}:${r.hasTmdb ? "tmdb" : "anilist"}` }))),
  ];

  for (let i = 0; i < scores.length; i += CHUNK) {
    const values = scores.slice(i, i + CHUNK).map(([id, q]) => sql`(${id}::integer, ${q}::real)`);
    // Raw SQL so updated_at stays put: nightly sync uses it to find the stalest titles.
    await db.execute(sql`
      update ${titles} set quality = v.quality
      from (values ${sql.join(values, sql`, `)}) as v(id, quality)
      where ${titles.id} = v.id
    `);
  }
  console.log(`quality: scored ${scores.filter(([, q]) => q != null).length}/${scores.length} titles`);
} finally {
  await db.$client.end();
}
