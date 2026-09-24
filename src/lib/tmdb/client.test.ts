import { describe, expect, it, vi } from "vitest";

import discoverFixture from "./__fixtures__/discover-movie-page1.json";
import movieFixture from "./__fixtures__/movie-550.json";
import tvFixture from "./__fixtures__/tv-1399.json";
import { createTmdbClient, TmdbError } from "./client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

function setup(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetch.mockRejectedValueOnce(r);
    else fetch.mockResolvedValueOnce(r);
  }
  const sleep = vi.fn(async (ms: number) => void ms);
  const client = createTmdbClient({ token: "tok", fetch, sleep, minIntervalMs: 0 });
  return { client, fetch, sleep };
}

describe("tmdb client", () => {
  it("fetches movie details with appended sub-resources and the bearer token", async () => {
    const { client, fetch } = setup(json(movieFixture));
    const movie = await client.movie(550);

    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.themoviedb.org/3/movie/550?append_to_response=keywords%2Crecommendations%2Cexternal_ids%2Cwatch%2Fproviders%2Crelease_dates",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer tok");

    expect(movie.title).toBe("Fight Club");
    expect(movie.keywords.keywords.map((k) => k.name)).toContain("dystopia");
    expect(movie.recommendations.results.map((r) => r.id)).toEqual([680, 807]);
    expect(movie.external_ids.imdb_id).toBe("tt0137523");
    expect(movie["watch/providers"].results.IN.flatrate?.[0].provider_name).toBe("JioHotstar");
    expect(movie).not.toHaveProperty("budget");
  });

  it("parses tv details, whose keywords live under results", async () => {
    const { client } = setup(json(tvFixture));
    const tv = await client.tv(1399);
    expect(tv.name).toBe("Game of Thrones");
    expect(tv.keywords.results).toHaveLength(2);
    expect(tv.content_ratings.results[0].rating).toBe("TV-MA");
  });

  it("passes discover params through the query string", async () => {
    const { client, fetch } = setup(json(discoverFixture));
    const page = await client.discover("movie", { sort_by: "vote_count.desc", page: 1 });
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get("sort_by")).toBe(
      "vote_count.desc",
    );
    expect(page.total_pages).toBe(500);
    expect(page.results.map((r) => r.id)).toEqual([550, 680]);
  });

  it("retries 429 using Retry-After, then 5xx with exponential backoff", async () => {
    const { client, sleep } = setup(
      json({}, { status: 429, headers: { "Retry-After": "2" } }),
      json({}, { status: 503 }),
      new TypeError("fetch failed"),
      json(discoverFixture),
    );
    await client.discover("movie");
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 1000, 2000]);
  });

  it("throws immediately on a 4xx other than 429", async () => {
    const { client, fetch } = setup(json({}, { status: 404 }));
    await expect(client.movie(1)).rejects.toEqual(new TmdbError(404, "/movie/1"));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries", async () => {
    const fetch = vi.fn(async () => json({}, { status: 500 }));
    const client = createTmdbClient({
      token: "t",
      fetch,
      sleep: async () => {},
      minIntervalMs: 0,
      maxRetries: 2,
    });
    await expect(client.discover("tv")).rejects.toBeInstanceOf(TmdbError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects responses that don't match the schema", async () => {
    const { client } = setup(json({ id: 550 }));
    await expect(client.movie(550)).rejects.toThrow();
  });

  it("spaces requests by minIntervalMs", async () => {
    const fetch = vi.fn(async () => json(discoverFixture));
    const sleep = vi.fn(async (ms: number) => void ms);
    const client = createTmdbClient({ token: "t", fetch, sleep, minIntervalMs: 100 });
    await Promise.all([client.discover("movie"), client.discover("movie"), client.discover("movie")]);
    const waits = sleep.mock.calls.map(([ms]) => ms);
    expect(waits).toHaveLength(2);
    expect(waits[0]).toBeGreaterThan(90);
    expect(waits[1]).toBeGreaterThan(190);
  });
});
