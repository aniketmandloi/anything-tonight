import type { db as Db } from "@/db/client";
import type { AniListClient } from "@/lib/anilist/client";

import { mapAniListMedia } from "./anilist-map";
import type { IngestCounts } from "./types";
import { upsertCatalogEntry } from "./upsert";

// Pages already carry full records, so every title is upserted; resume with startPage.
export async function ingestAniListPages(
  db: typeof Db,
  anilist: AniListClient,
  opts: { startPage: number; pages: number; sort: string },
): Promise<IngestCounts> {
  const counts: IngestCounts = { upserted: 0, skipped: 0, failed: 0 };
  const lastPage = opts.startPage + opts.pages - 1;

  for (let page = opts.startPage; page <= lastPage; page++) {
    const { media, hasNextPage } = await anilist.mediaPage({ page, sort: [opts.sort] });

    await Promise.all(
      media.map(async (m) => {
        try {
          await upsertCatalogEntry(db, mapAniListMedia(m));
          counts.upserted++;
        } catch (err) {
          counts.failed++;
          console.error(`anilist ${m.id}:`, err instanceof Error ? err.message : err);
        }
      }),
    );

    console.log(`anilist page ${page}/${lastPage}`, counts);
    if (!hasNextPage) break;
  }
  return counts;
}
