import { and, asc, eq, inArray } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleExternalIds, titles } from "@/db/schema";
import type { AniListClient } from "@/lib/anilist/client";
import { upsertWithAnimeMapping } from "@/lib/catalog/anime-link";
import { mapAniListMedia } from "@/lib/catalog/anilist-map";
import { ingestTmdbTitle, tmdbSource } from "@/lib/catalog/tmdb-ingest";
import type { ExternalSource } from "@/lib/catalog/types";
import type { MediaType, TmdbClient } from "@/lib/tmdb/client";

import { batchTmdbIds, nextAniListPage, type SyncMessage, type syncWindow } from "./plan";

// Titles re-ingested per day regardless of changes, oldest first, so watch providers
// (which TMDB's /changes doesn't report) are at most catalog size / this many days old.
const STALE_PER_DAY = 1000;

async function knownIds(db: typeof Db, source: ExternalSource, ids: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const rows = await db
      .select({ id: titleExternalIds.externalId })
      .from(titleExternalIds)
      .where(and(eq(titleExternalIds.source, source), inArray(titleExternalIds.externalId, ids.slice(i, i + 1000))));
    for (const r of rows) known.add(r.id);
  }
  return known;
}

async function changedCatalogIds(
  db: typeof Db,
  tmdb: TmdbClient,
  type: MediaType,
  window: ReturnType<typeof syncWindow>,
): Promise<number[]> {
  const changed: string[] = [];
  for (let page = 1; ; page++) {
    const res = await tmdb.changes(type, { start_date: window.startDate, end_date: window.endDate, page });
    changed.push(...res.results.map((r) => String(r.id)));
    if (page >= res.total_pages) break;
  }
  const known = await knownIds(db, tmdbSource(type), changed);
  return changed.filter((id) => known.has(id)).map(Number);
}

async function stalestTmdbTitles(db: typeof Db, type: MediaType, limit: number): Promise<number[]> {
  const rows = await db
    .select({ id: titleExternalIds.externalId })
    .from(titleExternalIds)
    .innerJoin(titles, eq(titles.id, titleExternalIds.titleId))
    .where(eq(titleExternalIds.source, tmdbSource(type)))
    .orderBy(asc(titles.updatedAt))
    .limit(limit);
  return rows.map((r) => Number(r.id));
}

// Everything the nightly cron fans out: TMDB titles changed in the window, the stalest
// titles, and the first AniList page.
export async function planNightlySync(
  db: typeof Db,
  tmdb: TmdbClient,
  window: ReturnType<typeof syncWindow>,
): Promise<SyncMessage[]> {
  const messages: SyncMessage[] = [];
  for (const type of ["movie", "tv"] as const) {
    const ids = [
      ...(await changedCatalogIds(db, tmdb, type, window)),
      ...(await stalestTmdbTitles(db, type, STALE_PER_DAY / 2)),
    ];
    messages.push(...batchTmdbIds(type, ids));
  }
  messages.push({ kind: "anilist", page: 1, since: window.since });
  return messages;
}

export type SyncDeps = {
  tmdb: TmdbClient;
  anilist: AniListClient;
  send: (message: SyncMessage) => Promise<unknown>;
};

// Queue consumer. Throws when anything failed so the queue redelivers; upserts are idempotent.
export async function handleSyncMessage(db: typeof Db, message: SyncMessage, deps: SyncDeps) {
  if (message.kind === "tmdb") {
    const results = await Promise.all(
      message.ids.map((id) => ingestTmdbTitle(db, deps.tmdb, message.type, id)),
    );
    const failed = results.filter((ok) => !ok).length;
    if (failed > 0) throw new Error(`${failed}/${results.length} ${message.type} titles failed`);
    return;
  }

  const { media, hasNextPage } = await deps.anilist.mediaPage({
    page: message.page,
    sort: ["UPDATED_AT_DESC"],
  });
  const known = await knownIds(db, "anilist", media.map((m) => String(m.id)));
  for (const m of media) {
    if (known.has(String(m.id)) && (m.updatedAt ?? 0) >= message.since) {
      await upsertWithAnimeMapping(db, mapAniListMedia(m));
    }
  }
  const next = nextAniListPage(message.page, media, hasNextPage, message.since);
  if (next !== null) await deps.send({ ...message, page: next });
}
