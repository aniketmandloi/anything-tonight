import { send } from "@vercel/queue";

import { createAniListClient } from "@/lib/anilist/client";
import { createTmdbClient } from "@/lib/tmdb/client";

import { SYNC_TOPIC, type SyncMessage } from "./plan";
import type { SyncDeps } from "./run";

export function tmdbFromEnv() {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");
  return createTmdbClient({ token });
}

export function syncDeps(): SyncDeps {
  return {
    tmdb: tmdbFromEnv(),
    anilist: createAniListClient(),
    send: (message: SyncMessage) => send(SYNC_TOPIC, message),
  };
}
