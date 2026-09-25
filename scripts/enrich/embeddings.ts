// Embeds titles that have no embedding yet or whose embedding text changed. Each batch is
// written as soon as it returns, so an interrupted run resumes where it stopped.
// Usage: pnpm enrich:embeddings [--limit N] [--batch N]
import { parseArgs } from "node:util";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { EMBEDDING_DIMENSIONS, titles } from "@/db/schema";
import { EMBEDDING_MODEL, planEmbeddings } from "@/engine/embeddings";
import { createOpenAIClient } from "@/lib/openai/client";

const { values } = parseArgs({
  options: { limit: { type: "string" }, batch: { type: "string", default: "100" } },
});

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
const openai = createOpenAIClient({ apiKey });

const batchSize = Number(values.batch);
const counts = { embedded: 0, failed: 0 };

try {
  const rows = await db
    .select({
      id: titles.id,
      type: titles.type,
      overview: titles.overview,
      genres: titles.genres,
      keywords: titles.keywords,
      embeddingHash: titles.embeddingHash,
    })
    .from(titles)
    .orderBy(titles.id);
  const planned = planEmbeddings(rows);
  const jobs = values.limit ? planned.slice(0, Number(values.limit)) : planned;
  console.log(`embeddings: ${planned.length}/${rows.length} titles need embedding, running ${jobs.length}`);

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    try {
      const vectors = await openai.embed(EMBEDDING_MODEL, batch.map((j) => j.text));
      if (vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
        throw new Error(`${EMBEDDING_MODEL} returned vectors that aren't ${EMBEDDING_DIMENSIONS}-dimensional`);
      }
      const rowsSql = batch.map(
        (j, k) => sql`(${j.id}::integer, ${JSON.stringify(vectors[k])}::vector, ${j.hash})`,
      );
      // Raw SQL so updated_at stays put: nightly sync uses it to find the stalest titles.
      await db.execute(sql`
        update ${titles} set embedding = v.embedding, embedding_hash = v.hash
        from (values ${sql.join(rowsSql, sql`, `)}) as v(id, embedding, hash)
        where ${titles.id} = v.id
      `);
      counts.embedded += batch.length;
    } catch (err) {
      counts.failed += batch.length;
      console.error(`batch at ${i}:`, err instanceof Error ? err.message : err);
      // A first batch that fails (bad key, billing) would fail every batch after it too.
      if (counts.embedded === 0) break;
    }
    console.log(`embeddings ${Math.min(i + batchSize, jobs.length)}/${jobs.length}`, counts);
  }
  if (counts.failed > 0) process.exitCode = 1;
} finally {
  await db.$client.end();
}
