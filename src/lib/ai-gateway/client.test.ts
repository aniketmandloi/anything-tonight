import { describe, expect, it, vi } from "vitest";

import { createGatewayClient, GatewayError } from "./client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

function setup(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetch.mockRejectedValueOnce(r);
    else fetch.mockResolvedValueOnce(r);
  }
  const sleep = vi.fn(async (ms: number) => void ms);
  const client = createGatewayClient({ apiKey: "key", fetch, sleep, maxRetries: 2 });
  return { client, fetch, sleep };
}

const embeddings = {
  object: "list",
  data: [
    { object: "embedding", index: 1, embedding: [0, 1] },
    { object: "embedding", index: 0, embedding: [1, 0] },
  ],
  usage: { prompt_tokens: 4, total_tokens: 4 },
};

describe("ai gateway client", () => {
  it("posts inputs to /embeddings and returns vectors in input order", async () => {
    const { client, fetch } = setup(json(embeddings));
    const vectors = await client.embed("openai/text-embedding-3-small", ["a", "b"]);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/embeddings");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer key");
    expect(JSON.parse(String(init?.body))).toEqual({ model: "openai/text-embedding-3-small", input: ["a", "b"] });
    expect(vectors).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it("rejects a response with the wrong number of vectors", async () => {
    const { client } = setup(json(embeddings));
    await expect(client.embed("m", ["a"])).rejects.toThrow("2 embeddings for 1 inputs");
  });

  it("retries rate limits, server errors and network failures", async () => {
    const { client, fetch, sleep } = setup(
      new Response("slow down", { status: 429, headers: { "retry-after": "3" } }),
      new TypeError("fetch failed"),
      json(embeddings),
    );
    await client.embed("m", ["a", "b"]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([3000, 2000]);
  });

  it("fails fast on client errors with the gateway's message", async () => {
    const { client, fetch } = setup(new Response('{"error":{"type":"authentication_error"}}', { status: 401 }));
    const err = await client.embed("m", ["a"]).catch((e) => e);
    expect(err).toBeInstanceOf(GatewayError);
    expect(err.message).toContain("authentication_error");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries", async () => {
    const { client, fetch } = setup(
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
      new Response("down", { status: 503 }),
    );
    await expect(client.embed("m", ["a"])).rejects.toThrow("AI Gateway 503 for /embeddings: down");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
