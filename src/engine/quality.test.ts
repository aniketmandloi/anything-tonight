import { describe, expect, it } from "vitest";

import { computeQuality, poolStats, weightedRating, type QualityInput } from "./quality";

const title = (id: number, voteAvg: number | null, voteCount: number | null, pool = "movie"): QualityInput => ({
  id,
  pool,
  voteAvg,
  voteCount,
});

describe("poolStats", () => {
  it("uses the mean rating and median vote count of rated titles", () => {
    expect(poolStats([title(1, 8, 100), title(2, 6, 300), title(3, 7, 200), title(4, null, null)])).toEqual({
      mean: 7,
      minVotes: 200,
    });
  });

  it("returns null when nothing in the pool has votes", () => {
    expect(poolStats([title(1, null, null), title(2, 9, 0)])).toBeNull();
  });
});

describe("weightedRating", () => {
  const stats = { mean: 7, minVotes: 1000 };

  it("shrinks low-vote titles toward the pool mean", () => {
    expect(weightedRating(10, 3, stats)).toBeCloseTo(7.009, 3);
    expect(weightedRating(2, 3, stats)).toBeCloseTo(6.985, 3);
  });

  it("keeps well-voted titles close to their own rating", () => {
    expect(weightedRating(9, 1_000_000, stats)).toBeCloseTo(8.998, 3);
  });

  it("weights own rating and mean equally at the median vote count", () => {
    expect(weightedRating(9, 1000, stats)).toBe(8);
  });
});

describe("computeQuality", () => {
  it("ranks a 3-vote perfect score below a well-voted good title", () => {
    const scores = computeQuality([title(1, 10, 3), title(2, 8.5, 5000), title(3, 6, 800), title(4, 7, 1200)]);
    expect(scores.get(1)!).toBeLessThan(scores.get(2)!);
  });

  it("scores each pool against its own stats", () => {
    const scores = computeQuality([
      title(1, 8, 100, "anime:tmdb"),
      title(2, 6, 100, "anime:tmdb"),
      title(3, 8, 100_000, "anime:anilist"),
      title(4, 6, 300_000, "anime:anilist"),
    ]);
    expect(scores.get(1)).toBeCloseTo(7.5, 6);
    expect(scores.get(3)).toBeCloseTo(7.333, 3);
  });

  it("leaves titles without votes unscored", () => {
    const scores = computeQuality([title(1, 8, 100), title(2, null, null), title(3, 5, 0)]);
    expect(scores.get(2)).toBeNull();
    expect(scores.get(3)).toBeNull();
  });
});
