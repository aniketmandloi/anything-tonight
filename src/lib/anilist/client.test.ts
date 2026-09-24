import { describe, expect, it, vi } from "vitest";

import pageFixture from "./__fixtures__/media-page.json";
import { AniListError, createAniListClient } from "./client";

const res = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function setup(responses: (Response | Error)[], start = 1_000_000) {
  let clock = start;
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetch.mockRejectedValueOnce(r);
    else fetch.mockResolvedValueOnce(r);
  }
  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const client = createAniListClient({ fetch, sleep, now: () => clock });
  return { client, fetch, sleep };
}

describe("anilist client", () => {
  it("posts the media page query and parses a live response", async () => {
    const { client, fetch } = setup([res(pageFixture)]);
    const page = await client.mediaPage({ page: 1, perPage: 2 });

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(body.variables).toEqual({ page: 1, perPage: 2, sort: ["POPULARITY_DESC"] });
    expect(body.query).toContain("idMal");

    expect(page.hasNextPage).toBe(true);
    const [aot] = page.media;
    expect(aot.title.english).toBe("Attack on Titan");
    expect(aot.idMal).toBe(16498);
    expect(aot.tags.length).toBeGreaterThan(0);
    expect(aot.relations.edges.length).toBeGreaterThan(0);
    expect(aot.recommendations.nodes[0].mediaRecommendation?.id).toEqual(expect.any(Number));
  });

  it("paces requests at the limit reported by X-RateLimit-Limit", async () => {
    const { client, sleep } = setup([
      res(pageFixture, 200, { "X-RateLimit-Limit": "90", "X-RateLimit-Remaining": "89" }),
      res(pageFixture, 200, { "X-RateLimit-Limit": "90", "X-RateLimit-Remaining": "88" }),
      res(pageFixture, 200, { "X-RateLimit-Limit": "90", "X-RateLimit-Remaining": "87" }),
    ]);
    await Promise.all([1, 2, 3].map((page) => client.mediaPage({ page })));
    // The first gap uses the 30/min default; after that the header's 90/min applies.
    expect(sleep.mock.calls.map(([ms]) => Math.round(ms))).toEqual([2000, 667]);
  });

  it("waits until X-RateLimit-Reset once the budget is spent", async () => {
    const { client, sleep } = setup([
      res(pageFixture, 200, {
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "1030",
      }),
      res(pageFixture),
    ]);
    await client.mediaPage({ page: 1 });
    await client.mediaPage({ page: 2 });
    expect(sleep).toHaveBeenCalledWith(30_000);
  });

  it("retries a 429 after Retry-After and a network error with backoff", async () => {
    const { client, sleep, fetch } = setup([
      res({ errors: [{ message: "Too Many Requests." }] }, 429, { "Retry-After": "60" }),
      new TypeError("fetch failed"),
      res(pageFixture),
    ]);
    await client.mediaPage({ page: 1 });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(60_000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("throws on a GraphQL validation error without retrying", async () => {
    const { client, fetch } = setup([res({ errors: [{ message: "bad" }] }, 400)]);
    await expect(client.mediaPage({ page: 1 })).rejects.toBeInstanceOf(AniListError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps serving calls after one fails", async () => {
    const { client } = setup([res({}, 400), res(pageFixture)]);
    await expect(client.mediaPage({ page: 1 })).rejects.toThrow();
    await expect(client.mediaPage({ page: 2 })).resolves.toHaveProperty("hasNextPage");
  });
});
