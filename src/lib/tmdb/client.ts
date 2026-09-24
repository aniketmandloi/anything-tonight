import type { z } from "zod";

import {
  changesSchema,
  discoverSchema,
  movieDetailsSchema,
  tvDetailsSchema,
  type ChangesPage,
  type DiscoverPage,
  type MovieDetails,
  type TvDetails,
  type WatchProviders,
  watchProvidersSchema,
} from "./schemas";

const BASE_URL = "https://api.themoviedb.org/3";

const APPEND = {
  movie: "keywords,recommendations,external_ids,watch/providers,release_dates",
  tv: "keywords,recommendations,external_ids,watch/providers,content_ratings",
} as const;

export type MediaType = "movie" | "tv";
type Params = Record<string, string | number | boolean>;

export class TmdbError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`TMDB ${status} for ${path}`);
  }
}

export type TmdbClientOptions = {
  token: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  // TMDB allows roughly 40 req/s per IP; 20/s leaves headroom for parallel scripts.
  minIntervalMs?: number;
  maxRetries?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createTmdbClient({
  token,
  fetch: fetchFn = fetch,
  sleep = defaultSleep,
  minIntervalMs = 50,
  maxRetries = 5,
}: TmdbClientOptions) {
  let nextSlot = 0;

  async function throttle() {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + minIntervalMs;
    if (wait > 0) await sleep(wait);
  }

  async function get<T extends z.ZodType>(path: string, params: Params, schema: T) {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    for (let attempt = 0; ; attempt++) {
      await throttle();
      let res: Response | undefined;
      try {
        res = await fetchFn(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
      } catch (err) {
        if (attempt >= maxRetries) throw err;
      }

      if (res?.ok) return schema.parse(await res.json()) as z.infer<T>;
      if (res && res.status !== 429 && res.status < 500) throw new TmdbError(res.status, path);
      if (attempt >= maxRetries) throw new TmdbError(res?.status ?? 0, path);

      const retryAfter = Number(res?.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
    }
  }

  return {
    discover(type: MediaType, params: Params = {}): Promise<DiscoverPage> {
      return get(`/discover/${type}`, params, discoverSchema);
    },
    movie(id: number): Promise<MovieDetails> {
      return get(`/movie/${id}`, { append_to_response: APPEND.movie }, movieDetailsSchema);
    },
    tv(id: number): Promise<TvDetails> {
      return get(`/tv/${id}`, { append_to_response: APPEND.tv }, tvDetailsSchema);
    },
    watchProviders(type: MediaType, id: number): Promise<WatchProviders> {
      return get(`/${type}/${id}/watch/providers`, {}, watchProvidersSchema);
    },
    changes(type: MediaType, params: Params = {}): Promise<ChangesPage> {
      return get(`/${type}/changes`, params, changesSchema);
    },
  };
}

export type TmdbClient = ReturnType<typeof createTmdbClient>;
