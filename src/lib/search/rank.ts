export type SearchCandidate = {
  id: number;
  title: string;
  originalTitle: string | null;
  // pg_trgm word_similarity of the query against the better-matching of title/original_title.
  similarity: number;
  quality: number | null;
};

const EXACT_BOOST = 1;
const PREFIX_BOOST = 0.5;
const WORD_PREFIX_BOOST = 0.25;
// Quality breaks near-ties between matches. Popularity can't: TMDB and AniList measure it on
// scales ~1000× apart, so it isn't comparable across types.
const QUALITY_WEIGHT = 0.3;

// Lowercase, accents stripped and punctuation collapsed, so "pokemon" matches "Pokémon".
export function normalizeTitle(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function matchBoost(query: string, names: string[]): number {
  if (names.some((n) => n === query)) return EXACT_BOOST;
  if (names.some((n) => n.startsWith(query))) return PREFIX_BOOST;
  if (names.some((n) => n.split(" ").some((w) => w.startsWith(query)))) return WORD_PREFIX_BOOST;
  return 0;
}

export function searchScore(query: string, c: SearchCandidate): number {
  const names = [c.title, c.originalTitle].filter((n) => n != null).map(normalizeTitle);
  return (
    c.similarity + matchBoost(normalizeTitle(query), names) + QUALITY_WEIGHT * ((c.quality ?? 0) / 10)
  );
}

export function rankSearchResults<T extends SearchCandidate>(query: string, candidates: T[]): T[] {
  return candidates
    .map((c) => ({ c, score: searchScore(query, c) }))
    .sort((a, b) => b.score - a.score || a.c.id - b.c.id)
    .map(({ c }) => c);
}
