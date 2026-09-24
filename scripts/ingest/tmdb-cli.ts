import { parseArgs } from "node:util";

import { db } from "@/db/client";
import { ingestTmdbDiscover } from "@/lib/catalog/tmdb-ingest";
import { createTmdbClient, type MediaType } from "@/lib/tmdb/client";

export async function runTmdbDiscoverCli(type: MediaType) {
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

  try {
    const counts = await ingestTmdbDiscover(db, createTmdbClient({ token }), {
      type,
      startPage: Number(values["start-page"]),
      pages: Number(values.pages),
      sort: values.sort,
      refresh: values.refresh,
    });
    if (counts.failed > 0 && counts.upserted === 0) process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}
