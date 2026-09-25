export type OnboardingCandidate = {
  id: number;
  type: string;
  // Any taste-space vector: the title embedding, or genreVectors() until embeddings exist.
  vector: number[];
  // How recognizable the title is (e.g. popularity percentile within its source); each
  // cluster is represented by its highest-weight title, since users can only rate what they've seen.
  weight: number;
};

const TYPE_ORDER = ["movie", "tv", "anime"];
const MAX_ITERATIONS = 25;

// mulberry32: small, fast, and good enough for picking seeds.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v);
  return norm === 0 ? v : v.map((x) => x / norm);
}

function sqDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return sum;
}

function nearest(point: number[], centroids: number[][]): number {
  let best = 0;
  let bestDist = Infinity;
  centroids.forEach((c, i) => {
    const d = sqDist(point, c);
    if (d < bestDist) [best, bestDist] = [i, d];
  });
  return best;
}

// k-means++ seeding then Lloyd iterations; returns each point's cluster index.
export function kMeans(points: number[][], k: number, random: () => number): number[] {
  if (points.length === 0) return [];
  k = Math.min(k, points.length);
  const centroids = [points[Math.floor(random() * points.length)]];
  while (centroids.length < k) {
    const dists = points.map((p) => Math.min(...centroids.map((c) => sqDist(p, c))));
    const total = dists.reduce((a, b) => a + b, 0);
    // All remaining points coincide with a centroid: any of them is as good as another.
    if (total === 0) {
      centroids.push(points[centroids.length]);
      continue;
    }
    let r = random() * total;
    const i = dists.findIndex((d) => (r -= d) <= 0);
    centroids.push(points[i === -1 ? points.length - 1 : i]);
  }

  let labels = points.map((p) => nearest(p, centroids));
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      centroids[c] = members[0].map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length);
    }
    const next = points.map((p) => nearest(p, centroids));
    if (next.every((l, i) => l === labels[i])) break;
    labels = next;
  }
  return labels;
}

// Splits count evenly across types, handing slots a type can't fill to the others.
function quotas(sizes: Map<string, number>, count: number): Map<string, number> {
  const result = new Map([...sizes.keys()].map((t) => [t, 0]));
  let left = Math.min(count, [...sizes.values()].reduce((a, b) => a + b, 0));
  while (left > 0) {
    for (const [type, size] of sizes) {
      if (left > 0 && result.get(type)! < size) {
        result.set(type, result.get(type)! + 1);
        left--;
      }
    }
  }
  return result;
}

// Picks titles that spread across types and, within each type, across taste clusters, so a
// quick round of swipes says something about every corner of the catalog.
export function selectOnboardingTitles(
  candidates: OnboardingCandidate[],
  { count = 20, seed = 1 }: { count?: number; seed?: number } = {},
): number[] {
  const random = seededRandom(seed);
  const byType = Map.groupBy(candidates, (c) => c.type);
  const types = [...byType.keys()].sort(
    (a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );
  const perType = quotas(new Map(types.map((t) => [t, byType.get(t)!.length])), count);

  const picks = types.map((type) => {
    // Sorted by id so the result doesn't depend on input order.
    const members = [...byType.get(type)!].sort((a, b) => a.id - b.id);
    const labels = kMeans(
      members.map((m) => normalize(m.vector)),
      perType.get(type)!,
      random,
    );
    const clusters = Map.groupBy(members, (_, i) => labels[i]);
    // Biggest clusters first: they're the mainstream of the type.
    const picked = [...clusters.values()]
      .sort((a, b) => b.length - a.length)
      .map((cluster) => cluster.reduce((best, m) => (m.weight > best.weight ? m : best)).id);
    // Identical vectors (common with genre vectors) can leave fewer clusters than slots;
    // the most recognizable remaining titles fill the rest.
    const rest = members.filter((m) => !picked.includes(m.id)).sort((a, b) => b.weight - a.weight);
    return [...picked, ...rest.slice(0, perType.get(type)! - picked.length).map((m) => m.id)];
  });

  // Interleave types so the deck alternates rather than running through one type at a time.
  const total = picks.reduce((n, p) => n + p.length, 0);
  const deck: number[] = [];
  for (let i = 0; deck.length < total; i++) {
    for (const p of picks) if (i < p.length) deck.push(p[i]);
  }
  return deck;
}

// Multi-hot genre vectors over the candidates' combined genre vocabulary.
export function genreVectors(titles: { genres: string[] }[]): number[][] {
  const vocabulary = [...new Set(titles.flatMap((t) => t.genres))].sort();
  return titles.map((t) => vocabulary.map((g) => (t.genres.includes(g) ? 1 : 0)));
}
