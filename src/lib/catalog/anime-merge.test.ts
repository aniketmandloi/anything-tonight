import { describe, expect, it } from "vitest";

import type { AnimeIdMapRow } from "./anime-id-map";
import { familyOf, mergeSharedTitle, planAnimeUpsert } from "./anime-merge";
import type { CatalogEntry, TitleFields } from "./types";

const tmdbShow: TitleFields = {
  type: "tv",
  title: "Attack on Titan",
  originalTitle: "進撃の巨人",
  overview: "TMDB synopsis",
  year: 2013,
  runtime: null,
  genres: ["Animation", "Sci-Fi & Fantasy"],
  keywords: ["dystopia"],
  originalLanguage: "ja",
  maturity: "TV-MA",
  posterPath: "/tmdb.jpg",
  backdropPath: null,
  voteAvg: 8.7,
  voteCount: 7000,
  popularity: 120,
};

const anilistS1: TitleFields = {
  type: "anime",
  title: "Attack on Titan",
  originalTitle: "Shingeki no Kyojin",
  overview: "AniList synopsis",
  year: 2013,
  runtime: 24,
  genres: ["Action", "Drama"],
  keywords: ["Kaiju", "Military"],
  originalLanguage: "ja",
  maturity: null,
  posterPath: "https://s4.anilist.co/cover.jpg",
  backdropPath: "https://s4.anilist.co/banner.jpg",
  voteAvg: 8.5,
  voteCount: 610640,
  popularity: 900000,
};

describe("mergeSharedTitle", () => {
  it("lets AniList write only its owned fields and fill gaps", () => {
    const merged = mergeSharedTitle(tmdbShow, anilistS1, "anilist");
    expect(merged).toMatchObject({
      type: "anime",
      genres: ["Action", "Drama"],
      keywords: ["Kaiju", "Military"],
      runtime: 24,
      originalTitle: "Shingeki no Kyojin",
      // TMDB-owned fields are kept
      overview: "TMDB synopsis",
      posterPath: "/tmdb.jpg",
      voteAvg: 8.7,
      voteCount: 7000,
      popularity: 120,
      maturity: "TV-MA",
      // gap filled from AniList
      backdropPath: "https://s4.anilist.co/banner.jpg",
    });
  });

  it("lets TMDB overwrite its fields without touching AniList's", () => {
    const current = mergeSharedTitle(tmdbShow, anilistS1, "anilist");
    const merged = mergeSharedTitle(current, { ...tmdbShow, voteCount: 7100, runtime: 25 }, "tmdb");
    expect(merged).toMatchObject({
      type: "anime",
      voteCount: 7100,
      runtime: 24,
      keywords: ["Kaiju", "Military"],
    });
  });

  it("never replaces a value with an empty one", () => {
    const merged = mergeSharedTitle(anilistS1, { ...tmdbShow, overview: "", posterPath: null }, "tmdb");
    expect(merged.overview).toBe("AniList synopsis");
    expect(merged.posterPath).toBe("https://s4.anilist.co/cover.jpg");
  });
});

describe("planAnimeUpsert", () => {
  const map = (row: Partial<AnimeIdMapRow>): AnimeIdMapRow => ({
    anilistId: 16498,
    malId: 16498,
    tmdbSource: "tmdb_tv",
    tmdbId: "1429",
    tmdbSeason: 1,
    canonical: true,
    ...row,
  });
  const anilistEntry: CatalogEntry = {
    title: anilistS1,
    externalIds: [
      { source: "anilist", externalId: "20958" },
      { source: "mal", externalId: "25777" },
    ],
    relations: [],
  };
  const tmdbEntry: CatalogEntry = {
    title: tmdbShow,
    externalIds: [{ source: "tmdb_tv", externalId: "1429" }],
    relations: [],
  };

  it("passes unmapped entries through", () => {
    expect(planAnimeUpsert(tmdbEntry, undefined)).toEqual({ kind: "upsert", entry: tmdbEntry });
  });

  it("links a canonical AniList entry to its TMDB show", () => {
    const plan = planAnimeUpsert(anilistEntry, map({}));
    expect(plan).toMatchObject({
      kind: "upsert",
      entry: { linkedIds: [{ source: "tmdb_tv", externalId: "1429" }] },
    });
  });

  it("turns later seasons into aliases of the show", () => {
    expect(planAnimeUpsert(anilistEntry, map({ anilistId: 20958, canonical: false }))).toEqual({
      kind: "alias",
      ids: anilistEntry.externalIds,
      show: { source: "tmdb_tv", externalId: "1429" },
    });
  });

  it("types a mapped TMDB title as anime and links its canonical AniList entry", () => {
    const plan = planAnimeUpsert(tmdbEntry, map({}));
    expect(plan).toMatchObject({
      kind: "upsert",
      entry: { title: { type: "anime" }, linkedIds: [{ source: "anilist", externalId: "16498" }] },
    });
  });

  it("classifies sources into families", () => {
    expect(familyOf("tmdb_movie")).toBe("tmdb");
    expect(familyOf("anilist")).toBe("anilist");
    expect(familyOf("mal")).toBeNull();
  });
});
