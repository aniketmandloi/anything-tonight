import { and, eq, sql } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { animeIdMap, titleExternalIds } from "@/db/schema";

import { planAnimeUpsert } from "./anime-merge";
import type { CatalogEntry, ExternalRef } from "./types";
import { findTitleId, upsertCatalogEntry } from "./upsert";

async function findAnimeMapping(db: typeof Db, own: ExternalRef) {
  if (own.source === "anilist") {
    const [row] = await db
      .select()
      .from(animeIdMap)
      .where(eq(animeIdMap.anilistId, Number(own.externalId)));
    return row;
  }
  if (own.source === "tmdb_tv" || own.source === "tmdb_movie") {
    const [row] = await db
      .select()
      .from(animeIdMap)
      .where(
        and(
          eq(animeIdMap.tmdbSource, own.source),
          eq(animeIdMap.tmdbId, own.externalId),
          eq(animeIdMap.canonical, true),
        ),
      );
    return row;
  }
  return undefined;
}

// The show's title is found by its TMDB id, or, before TMDB has been ingested, by its canonical AniList id.
export async function findShowTitleId(db: typeof Db, show: ExternalRef): Promise<number | undefined> {
  const byTmdb = await findTitleId(db, show.source, show.externalId);
  if (byTmdb !== undefined) return byTmdb;
  const [row] = await db
    .select({ id: titleExternalIds.titleId })
    .from(titleExternalIds)
    .innerJoin(
      animeIdMap,
      and(
        eq(titleExternalIds.source, "anilist"),
        eq(titleExternalIds.externalId, sql`${animeIdMap.anilistId}::text`),
      ),
    )
    .where(
      and(
        eq(animeIdMap.tmdbSource, show.source),
        eq(animeIdMap.tmdbId, show.externalId),
        eq(animeIdMap.canonical, true),
      ),
    );
  return row?.id;
}

// Upserts an entry, routing mapped anime to the one title per show. Later seasons and specials
// only attach their ids to the show's title, or are skipped until that title exists.
export async function upsertWithAnimeMapping(
  db: typeof Db,
  entry: CatalogEntry,
): Promise<"upserted" | "aliased" | "skipped"> {
  const plan = planAnimeUpsert(entry, await findAnimeMapping(db, entry.externalIds[0]));
  if (plan.kind === "upsert") {
    await upsertCatalogEntry(db, plan.entry);
    return "upserted";
  }

  const showId = await findShowTitleId(db, plan.show);
  if (showId === undefined) return "skipped";
  await db
    .insert(titleExternalIds)
    .values(plan.ids.map((e) => ({ ...e, titleId: showId })))
    .onConflictDoNothing();
  return "aliased";
}
