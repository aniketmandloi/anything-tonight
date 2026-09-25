import { describe, expect, it } from "vitest";

import { buildEmbeddingText, type EmbeddingSource } from "./embedding-text";

const interstellar: EmbeddingSource = {
  type: "movie",
  genres: ["Adventure", "Drama", "Science Fiction"],
  keywords: ["spacecraft", "race against time", "wormhole"],
  overview:
    "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.",
};

const frieren: EmbeddingSource = {
  type: "anime",
  genres: ["Adventure", "Drama", "Fantasy"],
  keywords: ["Elf", "Travel", "Iyashikei", " Magic ", "elf"],
  overview: "The adventure is over but life goes on for an elf mage.\n\nDecades after their victory,\r\n  Frieren sets out again.",
};

describe("buildEmbeddingText", () => {
  it("builds a movie's text from type, genres, keywords and overview", () => {
    expect(buildEmbeddingText(interstellar)).toBe(
      [
        "Type: Movie",
        "Genres: Adventure, Drama, Science Fiction",
        "Keywords: spacecraft, race against time, wormhole",
        "Overview: The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.",
      ].join("\n"),
    );
  });

  it("lowercases and dedupes AniList tags and flattens overview whitespace", () => {
    expect(buildEmbeddingText(frieren)).toBe(
      [
        "Type: Anime",
        "Genres: Adventure, Drama, Fantasy",
        "Keywords: elf, travel, iyashikei, magic",
        "Overview: The adventure is over but life goes on for an elf mage. Decades after their victory, Frieren sets out again.",
      ].join("\n"),
    );
  });

  it("omits empty sections", () => {
    expect(buildEmbeddingText({ type: "tv", genres: [], keywords: [], overview: null })).toBe("Type: TV series");
  });

  it("keeps only the first 25 keywords", () => {
    const keywords = Array.from({ length: 30 }, (_, i) => `k${i}`);
    const text = buildEmbeddingText({ ...interstellar, keywords });
    expect(text).toContain("k24");
    expect(text).not.toContain("k25");
  });

  it("is deterministic", () => {
    expect(buildEmbeddingText(frieren)).toBe(buildEmbeddingText(structuredClone(frieren)));
  });
});
