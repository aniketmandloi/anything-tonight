import { timingSafeEqual } from "node:crypto";

import type { MediaType } from "@/lib/tmdb/client";

export const SYNC_TOPIC = "catalog-sync";

export type SyncMessage =
  // Re-ingest these TMDB titles (metadata and watch providers).
  | { kind: "tmdb"; type: MediaType; ids: number[] }
  // Upsert catalog anime on one page of AniList's most recently updated list; the
  // consumer sends the next page itself, so AniList's 30 req/min limit sees one caller.
  | { kind: "anilist"; page: number; since: number };

// ~1s of TMDB requests at the client's pacing; small enough to retry a whole batch.
export const TMDB_BATCH = 20;

// The cron runs daily; looking back 36h means one late or failed run loses nothing.
const LOOKBACK_HOURS = 36;

export function syncWindow(now: Date) {
  const start = new Date(now.getTime() - LOOKBACK_HOURS * 3600_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return {
    startDate: day(start),
    endDate: day(now),
    since: Math.floor(start.getTime() / 1000),
  };
}

export function batchTmdbIds(type: MediaType, ids: number[]): SyncMessage[] {
  const unique = [...new Set(ids)];
  const messages: SyncMessage[] = [];
  for (let i = 0; i < unique.length; i += TMDB_BATCH) {
    messages.push({ kind: "tmdb", type, ids: unique.slice(i, i + TMDB_BATCH) });
  }
  return messages;
}

// Pages are sorted by updatedAt descending, so once a page ends before `since` we're done.
export function nextAniListPage(
  page: number,
  media: { updatedAt?: number | null }[],
  hasNextPage: boolean,
  since: number,
): number | null {
  const last = media.at(-1)?.updatedAt;
  return hasNextPage && last != null && last >= since ? page + 1 : null;
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without a secret the route stays closed.
export function isAuthorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
