import { mediaPageSchema, type Media } from "./schemas";

const ENDPOINT = "https://graphql.anilist.co";

const MEDIA_PAGE_QUERY = /* GraphQL */ `
  query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage }
      media(type: ANIME, isAdult: false, sort: $sort) {
        id
        idMal
        title { romaji english native }
        format
        status
        description(asHtml: false)
        startDate { year month day }
        seasonYear
        episodes
        duration
        countryOfOrigin
        genres
        tags { name rank isGeneralSpoiler isMediaSpoiler }
        averageScore
        popularity
        isAdult
        coverImage { extraLarge }
        bannerImage
        updatedAt
        relations { edges { relationType node { id type } } }
        recommendations(perPage: 10, sort: RATING_DESC) {
          nodes { rating mediaRecommendation { id } }
        }
      }
    }
  }
`;

export class AniListError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`AniList ${status}: ${detail}`);
  }
}

export type AniListClientOptions = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxRetries?: number;
};

export type MediaPageParams = {
  page: number;
  perPage?: number;
  sort?: string[];
};

export type MediaPage = { media: Media[]; hasNextPage: boolean };

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createAniListClient({
  fetch: fetchFn = fetch,
  sleep = defaultSleep,
  now = Date.now,
  maxRetries = 5,
}: AniListClientOptions = {}) {
  // Docs say 90/min but the live API has advertised 30 for a long time; start there and follow the headers.
  let limitPerMinute = 30;
  let remaining = Infinity;
  let resetAt = 0;
  let nextSlot = 0;
  let queue: Promise<unknown> = Promise.resolve();

  async function waitForSlot() {
    const t = now();
    const wait =
      remaining <= 0 ? Math.max(resetAt - t, 0) : Math.max(nextSlot - t, 0);
    if (wait > 0) await sleep(wait);
    nextSlot = Math.max(now(), nextSlot) + 60_000 / limitPerMinute;
  }

  function readRateHeaders(headers: Headers) {
    const limit = Number(headers.get("x-ratelimit-limit"));
    if (limit > 0) limitPerMinute = limit;
    const rem = headers.get("x-ratelimit-remaining");
    if (rem !== null) remaining = Number(rem);
    const reset = Number(headers.get("x-ratelimit-reset"));
    resetAt = reset > 0 ? reset * 1000 : now() + 60_000;
  }

  async function post(variables: Record<string, unknown>) {
    for (let attempt = 0; ; attempt++) {
      await waitForSlot();
      let res: Response | undefined;
      try {
        res = await fetchFn(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query: MEDIA_PAGE_QUERY, variables }),
        });
      } catch (err) {
        if (attempt >= maxRetries) throw err;
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      readRateHeaders(res.headers);
      if (res.ok) return res.json();

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) {
        throw new AniListError(res.status, await res.text());
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
    }
  }

  return {
    // Calls are serialized so the shared rate-limit state stays accurate.
    mediaPage({ page, perPage = 50, sort = ["POPULARITY_DESC"] }: MediaPageParams) {
      const run = queue.then(async (): Promise<MediaPage> => {
        const body = mediaPageSchema.parse(await post({ page, perPage, sort }));
        return { media: body.data.Page.media, hasNextPage: body.data.Page.pageInfo.hasNextPage };
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

export type AniListClient = ReturnType<typeof createAniListClient>;
