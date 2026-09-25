import type { titles } from "@/db/schema";

export type EmbeddingSource = Pick<typeof titles.$inferSelect, "type" | "overview" | "genres" | "keywords">;

const TYPE_LABEL = { movie: "Movie", tv: "TV series", anime: "Anime" } as const;

// Keywords come ordered by relevance (AniList tag rank, TMDB's own order); the tail adds noise.
const MAX_KEYWORDS = 25;

// The title name is left out on purpose: it would pull neighbours toward similar names
// ("Titanic" near "Attack on Titan") rather than similar content.
export function buildEmbeddingText(t: EmbeddingSource): string {
  // TMDB keywords are lowercase and AniList tags are Title Case; normalize so both embed alike.
  const keywords = [...new Set(t.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    MAX_KEYWORDS,
  );
  const overview = t.overview?.replace(/\s+/g, " ").trim();
  return [
    `Type: ${TYPE_LABEL[t.type]}`,
    t.genres.length > 0 && `Genres: ${t.genres.join(", ")}`,
    keywords.length > 0 && `Keywords: ${keywords.join(", ")}`,
    overview && `Overview: ${overview}`,
  ]
    .filter(Boolean)
    .join("\n");
}
