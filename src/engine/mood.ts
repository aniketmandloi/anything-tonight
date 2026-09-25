import { z } from "zod";

import type { titles } from "@/db/schema";

// Array order is the order of titles.mood. Reordering axes or changing what one means
// requires re-scoring every title.
export const MOOD_AXES = [
  { key: "light", low: "dark, bleak, grim", high: "light, upbeat, uplifting" },
  { key: "pace", low: "slow, contemplative", high: "fast, kinetic, action-packed" },
  { key: "easy", low: "cerebral, demands close attention", high: "easy, relaxed viewing" },
  { key: "intensity", low: "emotionally mild", high: "emotionally intense, devastating" },
  { key: "humor", low: "no humor", high: "constantly funny" },
  { key: "cozy", low: "not comforting at all", high: "cozy, warm, comforting" },
  { key: "tension", low: "relaxed, low stakes", high: "suspenseful, nail-biting" },
  { key: "romance", low: "no romance", high: "romance is the core" },
] as const;

export type MoodAxis = (typeof MOOD_AXES)[number]["key"];

// A closed vocabulary, so tags can be matched to mood chips deterministically.
export const MOOD_TAGS = [
  "feel-good",
  "heartwarming",
  "wholesome",
  "bittersweet",
  "tearjerker",
  "melancholic",
  "mind-bending",
  "thought-provoking",
  "slow burn",
  "adrenaline",
  "epic",
  "gritty",
  "unsettling",
  "dark comedy",
  "quirky",
  "whimsical",
  "nostalgic",
  "inspiring",
  "romantic",
  "chill",
] as const;

export const MAX_MOOD_TAGS = 4;

const axisScore = z.int().min(0).max(10);

export const moodScoreSchema = z.object({
  ...(Object.fromEntries(
    MOOD_AXES.map((a) => [a.key, axisScore.describe(`0 = ${a.low}, 10 = ${a.high}`)]),
  ) as Record<MoodAxis, typeof axisScore>),
  tags: z.array(z.enum(MOOD_TAGS)).max(MAX_MOOD_TAGS),
});

export type MoodScore = z.infer<typeof moodScoreSchema>;

export const moodBatchSchema = z.object({
  titles: z.array(moodScoreSchema.extend({ id: z.int() })),
});

export type MoodBatch = z.infer<typeof moodBatchSchema>;

// Packs scores into titles.mood: one value in [0, 1] per axis, in MOOD_AXES order.
export function packMood(score: MoodScore): number[] {
  return MOOD_AXES.map((a) => score[a.key] / 10);
}

// OpenAI strict structured output: every property required, no extra keys, no $schema.
const jsonSchema = z.toJSONSchema(moodBatchSchema);
delete jsonSchema.$schema;

export const moodResponseFormat = {
  type: "json_schema",
  json_schema: { name: "mood_scores", strict: true, schema: jsonSchema },
} as const;

export const MOOD_SYSTEM_PROMPT = `You score movies, TV series and anime on how watching them feels.

For each title, give an integer from 0 to 10 on every axis:
${MOOD_AXES.map((a) => `- ${a.key}: 0 = ${a.low}, 10 = ${a.high}`).join("\n")}

Then pick 0 to ${MAX_MOOD_TAGS} tags that fit strongly, only from: ${MOOD_TAGS.join(", ")}.

Rules:
- Score the experience of watching the whole title, not its premise. A comedy about grief can still be light.
- If you know the title, rely on that knowledge; the overview may be incomplete or misleading.
- Use the full range. 5 means genuinely middling, not unsure.
- Return exactly one result per input title, with its id.`;

export type MoodPromptTitle = Pick<
  typeof titles.$inferSelect,
  "id" | "type" | "title" | "year" | "genres" | "keywords" | "overview"
>;

const TYPE_LABEL = { movie: "movie", tv: "TV series", anime: "anime" } as const;

export function buildMoodPrompt(batch: MoodPromptTitle[]): string {
  return batch
    .map((t) =>
      [
        `id: ${t.id}`,
        `title: ${t.title}${t.year ? ` (${t.year})` : ""}, ${TYPE_LABEL[t.type]}`,
        t.genres.length > 0 && `genres: ${t.genres.join(", ")}`,
        t.keywords.length > 0 && `keywords: ${t.keywords.slice(0, 15).join(", ")}`,
        t.overview && `overview: ${t.overview.replace(/\s+/g, " ").trim()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
