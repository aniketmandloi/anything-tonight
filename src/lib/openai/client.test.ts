import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createOpenAIClient, OpenAIError } from "./client";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

function setup(...responses: (Response | Error)[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const r of responses) {
    if (r instanceof Error) fetch.mockRejectedValueOnce(r);
    else fetch.mockResolvedValueOnce(r);
  }
  const sleep = vi.fn(async (ms: number) => void ms);
  const client = createOpenAIClient({ apiKey: "key", fetch, sleep, maxRetries: 2 });
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

describe("openai client", () => {
  it("posts inputs to /embeddings and returns vectors in input order", async () => {
    const { client, fetch } = setup(json(embeddings));
    const vectors = await client.embed("text-embedding-3-small", ["a", "b"]);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer key");
    expect(JSON.parse(String(init?.body))).toEqual({ model: "text-embedding-3-small", input: ["a", "b"] });
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

  it("fails fast on client errors with OpenAI's message", async () => {
    const { client, fetch } = setup(new Response('{"error":{"type":"authentication_error"}}', { status: 401 }));
    const err = await client.embed("m", ["a"]).catch((e) => e);
    expect(err).toBeInstanceOf(OpenAIError);
    expect(err.message).toContain("authentication_error");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries", async () => {
    const { client, fetch } = setup(
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
      new Response("down", { status: 503 }),
    );
    await expect(client.embed("m", ["a"])).rejects.toThrow("OpenAI 503 for /embeddings: down");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 429 caused by running out of credit", async () => {
    const { client, fetch } = setup(
      new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }),
    );
    await expect(client.embed("m", ["a"])).rejects.toThrow("insufficient_quota");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("openai client structured output", () => {
  const schema = z.object({ answer: z.int() });
  const request = {
    model: "gpt-6-luna",
    system: "sys",
    user: "question",
    responseFormat: { type: "json_schema", json_schema: { name: "a", strict: true, schema: {} } } as const,
    schema,
  };
  const completion = (message: object, finish_reason = "stop") =>
    json({ id: "c", object: "chat.completion", choices: [{ index: 0, finish_reason, message: { role: "assistant", ...message } }] });

  it("sends system and user messages with the response format and parses the JSON reply", async () => {
    const { client, fetch } = setup(completion({ content: '{"answer":42}', refusal: null }));
    expect(await client.structured(request)).toEqual({ answer: 42 });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "gpt-6-luna",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "question" },
      ],
      response_format: request.responseFormat,
    });
  });

  it("throws on refusals, truncated output and replies that fail the schema", async () => {
    const { client } = setup(
      completion({ content: null, refusal: "no" }),
      completion({ content: '{"answ' }, "length"),
      completion({ content: '{"answer":"x"}' }),
    );
    await expect(client.structured(request)).rejects.toThrow("gpt-6-luna refused: no");
    await expect(client.structured(request)).rejects.toThrow("finish_reason length");
    await expect(client.structured(request)).rejects.toThrow();
  });
});
