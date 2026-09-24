import type { MovieDetails, TvDetails } from "@/lib/tmdb/schemas";

import type { CatalogEntry } from "./types";

export const yearOf = (date: string | null | undefined) =>
  date ? Number(date.slice(0, 4)) || null : null;

// TMDB returns recommendations best-first; weight 1 is the top pick.
export const rankedRecommendations = (results: { id: number }[]) =>
  results.map((r, i) => ({
    targetExternalId: String(r.id),
    kind: "recommendation",
    weight: 1 - i / results.length,
  }));

// US ratings are the most complete on TMDB; fall back to any region that has one.
export function pickCertification(byRegion: { region: string; value: string }[]) {
  const rated = byRegion.filter((r) => r.value.trim() !== "");
  return (rated.find((r) => r.region === "US") ?? rated[0])?.value ?? null;
}

export function mapTmdbMovie(d: MovieDetails): CatalogEntry {
  const certifications = d.release_dates.results.flatMap((r) =>
    r.release_dates.map((rd) => ({ region: r.iso_3166_1, value: rd.certification })),
  );

  return {
    title: {
      type: "movie",
      title: d.title,
      originalTitle: d.original_title ?? null,
      overview: d.overview || null,
      year: yearOf(d.release_date),
      runtime: d.runtime || null,
      genres: d.genres.map((g) => g.name),
      keywords: d.keywords.keywords.map((k) => k.name),
      originalLanguage: d.original_language ?? null,
      maturity: pickCertification(certifications),
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      voteAvg: d.vote_average ?? null,
      voteCount: d.vote_count ?? null,
      popularity: d.popularity ?? null,
    },
    externalIds: [
      { source: "tmdb_movie", externalId: String(d.id) },
      ...(d.external_ids.imdb_id ? [{ source: "imdb" as const, externalId: d.external_ids.imdb_id }] : []),
    ],
    relations: rankedRecommendations(d.recommendations.results),
  };
}

const ANIMATION_GENRE_ID = 16;

// Japanese animated series are anime; #16 later merges them with their AniList entries.
export const isAnime = (d: TvDetails) =>
  d.genres.some((g) => g.id === ANIMATION_GENRE_ID) &&
  (d.original_language === "ja" || (d.origin_country ?? []).includes("JP"));

export function mapTmdbTv(d: TvDetails): CatalogEntry {
  return {
    title: {
      type: isAnime(d) ? "anime" : "tv",
      title: d.name,
      originalTitle: d.original_name ?? null,
      overview: d.overview || null,
      year: yearOf(d.first_air_date),
      runtime: d.episode_run_time?.[0] || null,
      genres: d.genres.map((g) => g.name),
      keywords: d.keywords.results.map((k) => k.name),
      originalLanguage: d.original_language ?? null,
      maturity: pickCertification(
        d.content_ratings.results.map((r) => ({ region: r.iso_3166_1, value: r.rating })),
      ),
      posterPath: d.poster_path ?? null,
      backdropPath: d.backdrop_path ?? null,
      voteAvg: d.vote_average ?? null,
      voteCount: d.vote_count ?? null,
      popularity: d.popularity ?? null,
    },
    externalIds: [
      { source: "tmdb_tv", externalId: String(d.id) },
      ...(d.external_ids.imdb_id ? [{ source: "imdb" as const, externalId: d.external_ids.imdb_id }] : []),
    ],
    relations: rankedRecommendations(d.recommendations.results),
  };
}
