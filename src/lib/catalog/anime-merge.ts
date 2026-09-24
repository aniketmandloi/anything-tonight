import type { AnimeIdMapRow } from "./anime-id-map";
import type { CatalogEntry, ExternalRef, ExternalSource, TitleFields } from "./types";

export type SourceFamily = "tmdb" | "anilist";

export function familyOf(source: ExternalSource): SourceFamily | null {
  if (source === "tmdb_movie" || source === "tmdb_tv") return "tmdb";
  if (source === "anilist") return "anilist";
  return null;
}

// On a title both sources describe, AniList owns what it knows better for anime (tags, genres,
// per-episode runtime, native title); TMDB owns the rest, so its show-level scores, art and
// synopsis stay comparable with non-anime titles. Either side fills fields the other left empty.
const ANILIST_OWNED = new Set<keyof TitleFields>(["originalTitle", "genres", "keywords", "runtime"]);

const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

export function mergeSharedTitle(
  existing: TitleFields,
  incoming: TitleFields,
  from: SourceFamily,
): TitleFields {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    const owned = ANILIST_OWNED.has(key as keyof TitleFields) === (from === "anilist");
    if (!isEmpty(value) && (owned || isEmpty(existing[key as keyof TitleFields]))) {
      merged[key] = value;
    }
  }
  return { ...(merged as TitleFields), type: "anime" };
}

export type AnimePlan =
  | { kind: "upsert"; entry: CatalogEntry }
  // A later season or special of a show that already has a canonical entry: its ids are
  // attached to that show's title instead of creating a second one.
  | { kind: "alias"; ids: ExternalRef[]; show: ExternalRef };

// `mapping` is the anime_id_map row for the entry's own id: by AniList id for AniList
// entries, or the canonical row for the TMDB id for TMDB entries.
export function planAnimeUpsert(entry: CatalogEntry, mapping: AnimeIdMapRow | undefined): AnimePlan {
  if (!mapping) return { kind: "upsert", entry };
  const show: ExternalRef = { source: mapping.tmdbSource, externalId: mapping.tmdbId };

  if (entry.externalIds[0].source === "anilist") {
    return mapping.canonical
      ? { kind: "upsert", entry: { ...entry, linkedIds: [show] } }
      : { kind: "alias", ids: entry.externalIds, show };
  }

  return {
    kind: "upsert",
    entry: {
      ...entry,
      title: { ...entry.title, type: "anime" },
      linkedIds: [{ source: "anilist", externalId: String(mapping.anilistId) }],
    },
  };
}
