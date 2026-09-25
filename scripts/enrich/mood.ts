// Scores titles that have no mood vector yet, several titles per request. Each batch is
// written as soon as it returns, so an interrupted run resumes where it stopped.
// Usage: pnpm enrich:mood [--limit N] [--batch N] [--concurrency N]
import { parseArgs } from "node:util";

import { isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { titles } from "@/db/schema";
import {
  buildMoodPrompt,
  matchMoodResults,
  MOOD_MODEL,
  MOOD_SYSTEM_PROMPT,
  moodBatchSchema,
  moodResponseFormat,
  packMood,
  type MoodPromptTitle,
} from "@/engine/mood";
import { createOpenAIClient } from "@/lib/openai/client";

const { values } = parseArgs({
  options: {
    limit: { type: "string" },
    batch: { type: "string", default: "10" },
    concurrency: { type: "string", default: "4" },
  },
});

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
const openai = createOpenAIClient({ apiKey });

const batchSize = Number(values.batch);
const concurrency = Number(values.concurrency);
const counts = { scored: 0, skipped: 0, failed: 0 };

async function scoreBatch(batch: MoodPromptTitle[]) {
  const reply = await openai.structured({
    model: MOOD_MODEL,
    system: MOOD_SYSTEM_PROMPT,
    user: buildMoodPrompt(batch),
    responseFormat: moodResponseFormat,
    schema: moodBatchSchema,
  });
  const scores = matchMoodResults(batch.map((t) => t.id), reply);
  counts.skipped += batch.length - scores.size;
  if (scores.size === 0) return;

  const rowsSql = [...scores].map(
    ([id, s]) => sql`(${id}::integer, ${JSON.stringify(packMood(s))}::vector, ${sql.param(s.tags)}::text[])`,
  );
  // Raw SQL so updated_at stays put: nightly sync uses it to find the stalest titles.
  await db.execute(sql`
    update ${titles} set mood = v.mood, mood_tags = v.tags
    from (values ${sql.join(rowsSql, sql`, `)}) as v(id, mood, tags)
    where ${titles.id} = v.id
  `);
  counts.scored += scores.size;
}

try {
  const query = db
    .select({
      id: titles.id,
      type: titles.type,
      title: titles.title,
      year: titles.year,
      genres: titles.genres,
      keywords: titles.keywords,
      overview: titles.overview,
    })
    .from(titles)
    .where(isNull(titles.mood))
    .orderBy(titles.id);
  const todo = values.limit ? await query.limit(Number(values.limit)) : await query;
  console.log(`mood: scoring ${todo.length} titles with ${MOOD_MODEL}`);

  const batches: MoodPromptTitle[][] = [];
  for (let i = 0; i < todo.length; i += batchSize) batches.push(todo.slice(i, i + batchSize));

  for (let i = 0; i < batches.length; i += concurrency) {
    await Promise.all(
      batches.slice(i, i + concurrency).map(async (batch) => {
        try {
          await scoreBatch(batch);
        } catch (err) {
          counts.failed += batch.length;
          console.error(`batch from id ${batch[0].id}:`, err instanceof Error ? err.message : err);
        }
      }),
    );
    console.log(`mood ${Math.min((i + concurrency) * batchSize, todo.length)}/${todo.length}`, counts);
    // A first round that fails entirely (bad key, no credit) would fail every round after it too.
    if (counts.scored === 0 && counts.failed > 0) break;
  }
  if (counts.failed > 0 || counts.skipped > 0) process.exitCode = 1;
} finally {
  await db.$client.end();
}
