import { describe, expect, it } from "vitest";

import { MOOD_DIMENSIONS } from "@/db/schema";

import {
  buildMoodPrompt,
  MOOD_AXES,
  MOOD_SYSTEM_PROMPT,
  moodBatchSchema,
  moodResponseFormat,
  moodScoreSchema,
  packMood,
  type MoodScore,
} from "./mood";

const score: MoodScore = {
  light: 2,
  pace: 7,
  easy: 3,
  intensity: 9,
  humor: 1,
  cozy: 0,
  tension: 10,
  romance: 4,
  tags: ["gritty", "adrenaline"],
};

describe("mood axes", () => {
  it("match the width of titles.mood", () => {
    expect(MOOD_AXES).toHaveLength(MOOD_DIMENSIONS);
    expect(new Set(MOOD_AXES.map((a) => a.key)).size).toBe(MOOD_DIMENSIONS);
  });
});

describe("moodScoreSchema", () => {
  it("accepts a complete score", () => {
    expect(moodScoreSchema.parse(score)).toEqual(score);
  });

  it.each([
    ["an out-of-range axis", { ...score, tension: 11 }],
    ["a negative axis", { ...score, light: -1 }],
    ["a fractional axis", { ...score, pace: 6.5 }],
    ["a missing axis", { ...score, romance: undefined }],
    ["an unknown tag", { ...score, tags: ["spooky"] }],
    ["too many tags", { ...score, tags: ["epic", "gritty", "adrenaline", "unsettling", "slow burn"] }],
  ])("rejects %s", (_, input) => {
    expect(moodScoreSchema.safeParse(input).success).toBe(false);
  });
});

describe("packMood", () => {
  it("scales scores to [0, 1] in axis order", () => {
    expect(packMood(score)).toEqual([0.2, 0.7, 0.3, 0.9, 0.1, 0, 1, 0.4]);
  });
});

describe("moodResponseFormat", () => {
  it("is a strict schema: every property required and no extra keys", () => {
    const { schema } = moodResponseFormat.json_schema;
    expect(schema).not.toHaveProperty("$schema");
    expect(schema.additionalProperties).toBe(false);

    const item = (schema.properties as Record<string, { items: Record<string, unknown> }>).titles.items;
    expect(item.additionalProperties).toBe(false);
    expect([...(item.required as string[])].sort()).toEqual(
      [...MOOD_AXES.map((a) => a.key), "tags", "id"].sort(),
    );
  });

  it("parses a batch response", () => {
    const batch = { titles: [{ id: 7, ...score }] };
    expect(moodBatchSchema.parse(batch)).toEqual(batch);
  });
});

describe("mood prompts", () => {
  it("describes every axis in the system prompt", () => {
    for (const a of MOOD_AXES) expect(MOOD_SYSTEM_PROMPT).toContain(`- ${a.key}: 0 = ${a.low}, 10 = ${a.high}`);
  });

  it("lists each title with its id and skips empty fields", () => {
    const prompt = buildMoodPrompt([
      {
        id: 12,
        type: "anime",
        title: "Frieren: Beyond Journey's End",
        year: 2023,
        genres: ["Adventure", "Drama"],
        keywords: ["Elf", "Travel"],
        overview: "The adventure is over\n\nbut life goes on.",
      },
      { id: 13, type: "tv", title: "Untitled", year: null, genres: [], keywords: [], overview: null },
    ]);
    expect(prompt).toBe(
      [
        "id: 12",
        "title: Frieren: Beyond Journey's End (2023), anime",
        "genres: Adventure, Drama",
        "keywords: Elf, Travel",
        "overview: The adventure is over but life goes on.",
        "",
        "id: 13",
        "title: Untitled, TV series",
      ].join("\n"),
    );
  });
});
