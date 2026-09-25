export type QualityInput = {
  id: number;
  // Titles are only compared within a pool: vote counts from TMDB and AniList differ by orders
  // of magnitude, and each type has its own rating distribution.
  pool: string;
  voteAvg: number | null;
  voteCount: number | null;
};

export type PoolStats = { mean: number; minVotes: number };

const hasVotes = (t: QualityInput): t is QualityInput & { voteAvg: number; voteCount: number } =>
  t.voteAvg != null && t.voteCount != null && t.voteCount > 0;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function poolStats(titles: QualityInput[]): PoolStats | null {
  const rated = titles.filter(hasVotes);
  if (rated.length === 0) return null;
  return {
    mean: rated.reduce((sum, t) => sum + t.voteAvg, 0) / rated.length,
    minVotes: median(rated.map((t) => t.voteCount)),
  };
}

// IMDb-style weighted rating: v/(v+m)·R + m/(v+m)·C, with C the pool's mean rating and m its
// median vote count, so a title needs about a median number of votes to be half its own rating.
export function weightedRating(voteAvg: number, voteCount: number, stats: PoolStats): number {
  const v = voteCount;
  const m = stats.minVotes;
  return (v / (v + m)) * voteAvg + (m / (v + m)) * stats.mean;
}

export function computeQuality(titles: QualityInput[]): Map<number, number | null> {
  const pools = Map.groupBy(titles, (t) => t.pool);
  const scores = new Map<number, number | null>();
  for (const members of pools.values()) {
    const stats = poolStats(members);
    for (const t of members) {
      scores.set(t.id, stats && hasVotes(t) ? weightedRating(t.voteAvg, t.voteCount, stats) : null);
    }
  }
  return scores;
}
