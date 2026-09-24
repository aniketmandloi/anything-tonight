import type { Media } from "@/lib/anilist/schemas";

import type { CatalogEntry } from "./types";

// Below this AniList tag rank, tags are mostly noise for describing the show.
const MIN_TAG_RANK = 50;

const LANGUAGE_BY_COUNTRY: Record<string, string> = { JP: "ja", KR: "ko", CN: "zh", TW: "zh" };

const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#039;": "'", "&lt;": "<", "&gt;": ">" };

// AniList descriptions are light HTML even with asHtml: false, and often end with a "(Source: X)"
// credit and/or "Note:" airing trivia; neither belongs in the synopsis.
export function cleanDescription(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|quot|#039|lt|gt);/g, (e) => ENTITIES[e])
    .replace(/\s*\(Sources?:[^)]*\)[\s\S]*$/i, "")
    .replace(/\n\s*Notes?:[\s\S]*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

export function mapAniListMedia(m: Media): CatalogEntry {
  const votes = m.stats?.scoreDistribution?.reduce((sum, s) => sum + s.amount, 0);
  const recommended = m.recommendations.nodes.flatMap((n) =>
    n.mediaRecommendation ? [n.mediaRecommendation.id] : [],
  );

  return {
    title: {
      type: "anime",
      title: m.title.english ?? m.title.romaji ?? m.title.native ?? `AniList ${m.id}`,
      originalTitle: m.title.native ?? m.title.romaji ?? null,
      overview: cleanDescription(m.description),
      year: m.startDate.year ?? m.seasonYear ?? null,
      runtime: m.duration ?? null,
      genres: m.genres,
      keywords: m.tags
        .filter((t) => (t.rank ?? 0) >= MIN_TAG_RANK && !t.isGeneralSpoiler && !t.isMediaSpoiler)
        .map((t) => t.name),
      originalLanguage: (m.countryOfOrigin && LANGUAGE_BY_COUNTRY[m.countryOfOrigin]) ?? null,
      maturity: null,
      posterPath: m.coverImage?.extraLarge ?? null,
      backdropPath: m.bannerImage ?? null,
      // AniList scores are 0-100; TMDB's are 0-10.
      voteAvg: m.averageScore != null ? m.averageScore / 10 : null,
      voteCount: votes || null,
      popularity: m.popularity ?? null,
    },
    externalIds: [
      { source: "anilist", externalId: String(m.id) },
      ...(m.idMal ? [{ source: "mal" as const, externalId: String(m.idMal) }] : []),
    ],
    relations: [
      ...recommended.map((id, i) => ({
        targetExternalId: String(id),
        kind: "recommendation",
        weight: 1 - i / recommended.length,
      })),
      ...m.relations.edges.flatMap((e) =>
        e.node?.type === "ANIME" && e.relationType
          ? [{ targetExternalId: String(e.node.id), kind: e.relationType.toLowerCase(), weight: null }]
          : [],
      ),
    ],
  };
}
