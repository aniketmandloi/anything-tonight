const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

export type TmdbImageSize = `w${number}` | "original";

// TMDB rows store a relative path; AniList rows store a full URL, which has no size variants.
export function imageUrl(path: string | null, size: TmdbImageSize): string | null {
  if (!path) return null;
  return path.startsWith("https://") ? path : `${TMDB_IMAGE_BASE}${size}${path}`;
}
