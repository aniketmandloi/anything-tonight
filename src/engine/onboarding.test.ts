import { describe, expect, it } from "vitest";

import {
  genreVectors,
  kMeans,
  seededRandom,
  selectOnboardingTitles,
  type OnboardingCandidate,
} from "./onboarding";

const TYPES = ["movie", "tv", "anime"];
const CLUSTERS = 3;
const PER_CLUSTER = 10;

// Each (type, cluster) sits near its own axis; id = type*100 + cluster*10 + member, and member 0
// is the cluster's most recognizable title.
function fixture(types = TYPES, clusters = CLUSTERS): OnboardingCandidate[] {
  const jitter = seededRandom(42);
  const dims = types.length * clusters;
  return types.flatMap((type, t) =>
    Array.from({ length: clusters }, (_, c) =>
      Array.from({ length: PER_CLUSTER }, (_, m) => ({
        id: t * 100 + c * 10 + m,
        type,
        vector: Array.from({ length: dims }, (_, d) => (d === t * clusters + c ? 1 : 0) + jitter() * 0.1),
        weight: m === 0 ? 100 : jitter() * 50,
      })),
    ).flat(),
  );
}

const typeOf = (id: number) => TYPES[Math.floor(id / 100)];
const clusterOf = (id: number) => Math.floor(id / 10);

describe("kMeans", () => {
  it("separates well-separated groups", () => {
    const labels = kMeans([[0, 0], [0.1, 0], [10, 10], [10, 10.1]], 2, seededRandom(1));
    expect(labels[0]).toBe(labels[1]);
    expect(labels[2]).toBe(labels[3]);
    expect(labels[0]).not.toBe(labels[2]);
  });

  it("caps k at the number of points", () => {
    expect(new Set(kMeans([[1], [2]], 5, seededRandom(1))).size).toBe(2);
  });
});

describe("selectOnboardingTitles", () => {
  it("covers every type and every cluster when there are slots for them", () => {
    const picks = selectOnboardingTitles(fixture(), { count: 9 });
    expect(picks).toHaveLength(9);
    expect(new Set(picks.map(clusterOf)).size).toBe(9);
    for (const type of TYPES) expect(picks.filter((id) => typeOf(id) === type)).toHaveLength(3);
  });

  it("represents each cluster by its most recognizable title", () => {
    const picks = selectOnboardingTitles(fixture(), { count: 9 });
    expect(picks.every((id) => id % 10 === 0)).toBe(true);
  });

  it("is deterministic for a seed and ignores input order", () => {
    const candidates = fixture();
    const a = selectOnboardingTitles(candidates, { count: 12, seed: 7 });
    const b = selectOnboardingTitles([...candidates].reverse(), { count: 12, seed: 7 });
    expect(a).toEqual(b);
  });

  it("interleaves types", () => {
    const picks = selectOnboardingTitles(fixture(), { count: 6 });
    expect(picks.slice(0, 3).map(typeOf)).toEqual(["movie", "tv", "anime"]);
  });

  it("gives slots a type can't fill to the other types", () => {
    const candidates = [
      ...fixture(["movie", "tv"]),
      { id: 999, type: "anime", vector: [1, 0, 0, 0, 0, 0], weight: 1 },
    ];
    const picks = selectOnboardingTitles(candidates, { count: 9 });
    expect(picks).toHaveLength(9);
    expect(picks).toContain(999);
  });

  it("fills slots with top-weight titles when vectors don't separate", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({ id: i, type: "movie", vector: [1, 0], weight: i }));
    expect(selectOnboardingTitles(candidates, { count: 3 }).sort()).toEqual([2, 3, 4]);
  });

  it("returns everything when asked for more than it has", () => {
    expect(selectOnboardingTitles(fixture(["movie"], 1), { count: 50 })).toHaveLength(PER_CLUSTER);
  });
});

describe("genreVectors", () => {
  it("builds multi-hot vectors over the sorted genre vocabulary", () => {
    expect(genreVectors([{ genres: ["Drama", "Action"] }, { genres: ["Comedy"] }])).toEqual([
      [1, 0, 1],
      [0, 1, 0],
    ]);
  });
});
