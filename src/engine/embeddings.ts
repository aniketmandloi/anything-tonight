import { createHash } from "node:crypto";

import { buildEmbeddingText, type EmbeddingSource } from "./embedding-text";

// Must produce EMBEDDING_DIMENSIONS-sized vectors (see src/db/schema/titles.ts).
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export type EmbeddingCandidate = EmbeddingSource & { id: number; embeddingHash: string | null };
export type EmbeddingJob = { id: number; text: string; hash: string };

export function embeddingHash(model: string, text: string): string {
  return createHash("sha256").update(`${model}\n${text}`).digest("hex");
}

// A title needs (re-)embedding when it has none yet, or when its text or the model changed.
export function planEmbeddings(rows: EmbeddingCandidate[], model = EMBEDDING_MODEL): EmbeddingJob[] {
  return rows.flatMap((row) => {
    const text = buildEmbeddingText(row);
    const hash = embeddingHash(model, text);
    return hash === row.embeddingHash ? [] : [{ id: row.id, text, hash }];
  });
}
