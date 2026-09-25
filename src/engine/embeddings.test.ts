import { describe, expect, it } from "vitest";

import { buildEmbeddingText } from "./embedding-text";
import { EMBEDDING_MODEL, embeddingHash, planEmbeddings, type EmbeddingCandidate } from "./embeddings";

const row = (id: number, overview: string, hash: string | null = null): EmbeddingCandidate => ({
  id,
  type: "movie",
  genres: ["Drama"],
  keywords: [],
  overview,
  embeddingHash: hash,
});

const hashOf = (r: EmbeddingCandidate, model = EMBEDDING_MODEL) => embeddingHash(model, buildEmbeddingText(r));

describe("embeddingHash", () => {
  it("changes with the model and the text", () => {
    const base = embeddingHash("a/model", "text");
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(embeddingHash("a/model", "text")).toBe(base);
    expect(embeddingHash("b/model", "text")).not.toBe(base);
    expect(embeddingHash("a/model", "text!")).not.toBe(base);
  });
});

describe("planEmbeddings", () => {
  it("picks titles that are missing an embedding or whose text changed", () => {
    const fresh = row(1, "same");
    const stale = row(3, "new overview", hashOf(row(3, "old overview")));
    const jobs = planEmbeddings([{ ...fresh, embeddingHash: hashOf(fresh) }, row(2, "never embedded"), stale]);

    expect(jobs.map((j) => j.id)).toEqual([2, 3]);
    expect(jobs[1]).toEqual({ id: 3, text: buildEmbeddingText(stale), hash: hashOf(stale) });
  });

  it("re-embeds everything when the model changes", () => {
    const r = row(1, "same");
    expect(planEmbeddings([{ ...r, embeddingHash: hashOf(r) }], "other/model")).toHaveLength(1);
  });
});
