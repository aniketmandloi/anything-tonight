import { describe, expect, it } from "vitest";

import { normalizeTitle, rankSearchResults, type SearchCandidate } from "./rank";

const candidate = (
  id: number,
  title: string,
  similarity: number,
  quality: number | null = 7,
  originalTitle: string | null = null,
): SearchCandidate => ({ id, title, originalTitle, similarity, quality });

const ids = (query: string, candidates: SearchCandidate[]) =>
  rankSearchResults(query, candidates).map((c) => c.id);

describe("normalizeTitle", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeTitle("Pokémon: The  Movie!")).toBe("pokemon the movie");
  });
});

describe("rankSearchResults", () => {
  it("puts an exact title match above a better-rated title that contains the word", () => {
    expect(ids("dark", [candidate(1, "The Dark Knight", 1, 8.5), candidate(2, "Dark", 1, 8.1)])).toEqual([
      2, 1,
    ]);
  });

  it("puts a title that starts with the query above one that only contains it", () => {
    expect(
      ids("fri", [candidate(1, "Girlfriend, Girlfriend", 0.75, 7), candidate(2, "Frieren", 0.75, 7)]),
    ).toEqual([2, 1]);
  });

  it("boosts a word that starts with the query over a mid-word match", () => {
    expect(ids("king", [candidate(1, "Walking Dead", 0.8), candidate(2, "The Lion King", 0.8)])).toEqual([
      2, 1,
    ]);
  });

  it("matches on the original title", () => {
    expect(
      ids("sousou no frieren", [
        candidate(1, "Sousou Kakumei", 0.6, 9),
        candidate(2, "Frieren: Beyond Journey's End", 0.7, 9, "Sousou no Frieren"),
      ]),
    ).toEqual([2, 1]);
  });

  it("ignores accents when matching", () => {
    expect(ids("pokemon", [candidate(1, "Pokémon Horizons", 0.5), candidate(2, "Pokémon", 0.5)])).toEqual([
      2, 1,
    ]);
  });

  it("orders equal matches by quality, unrated last", () => {
    expect(
      ids("naruto", [
        candidate(1, "Naruto the Movie", 0.9, null),
        candidate(2, "Naruto Shippuden", 0.9, 8.5),
        candidate(3, "Naruto Spin-Off", 0.9, 6.5),
      ]),
    ).toEqual([2, 3, 1]);
  });

  it("still ranks a far better text match above a better-rated weak match", () => {
    expect(ids("monster", [candidate(1, "Monsters, Inc.", 0.55, 9), candidate(2, "Monster", 1, 5)])).toEqual([
      2, 1,
    ]);
  });

  it("breaks exact ties by id so results are stable", () => {
    expect(ids("x", [candidate(3, "Alpha", 0.5), candidate(1, "Beta", 0.5)])).toEqual([1, 3]);
  });
});
