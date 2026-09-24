// Loads anime from AniList into the catalog, 50 per page.
// Usage: pnpm ingest:anilist [--pages 20] [--start-page 1] [--sort POPULARITY_DESC]
import { parseArgs } from "node:util";

import { db } from "@/db/client";
import { createAniListClient } from "@/lib/anilist/client";
import { ingestAniListPages } from "@/lib/catalog/anilist-ingest";

const { values } = parseArgs({
  options: {
    pages: { type: "string", default: "20" },
    "start-page": { type: "string", default: "1" },
    sort: { type: "string", default: "POPULARITY_DESC" },
  },
});

try {
  const counts = await ingestAniListPages(db, createAniListClient(), {
    startPage: Number(values["start-page"]),
    pages: Number(values.pages),
    sort: values.sort,
  });
  if (counts.failed > 0 && counts.upserted === 0) process.exitCode = 1;
} finally {
  await db.$client.end();
}
