import { describe, expect, it } from "vitest";

import movieFixture from "@/lib/tmdb/__fixtures__/movie-550.json";
import tvFixture from "@/lib/tmdb/__fixtures__/tv-1399.json";
import { movieDetailsSchema, tvDetailsSchema } from "@/lib/tmdb/schemas";

import { mapTmdbMovie, mapTmdbTv, pickCertification, yearOf } from "./tmdb-map";

describe("mapTmdbMovie", () => {
  const movie = movieDetailsSchema.parse(movieFixture);

  it("maps details to a title row", () => {
    const { title } = mapTmdbMovie(movie);
    expect(title).toMatchObject({
      type: "movie",
      title: "Fight Club",
      year: 1999,
      runtime: 139,
      genres: ["Drama", "Thriller"],
      keywords: ["support group", "fight", "dystopia"],
      originalLanguage: "en",
      maturity: "R",
      voteCount: 26280,
    });
  });

  it("puts the TMDB movie id first, then IMDb", () => {
    expect(mapTmdbMovie(movie).externalIds).toEqual([
      { source: "tmdb_movie", externalId: "550" },
      { source: "imdb", externalId: "tt0137523" },
    ]);
  });

  it("weights recommendations by rank", () => {
    expect(mapTmdbMovie(movie).relations).toEqual([
      { targetExternalId: "680", kind: "recommendation", weight: 1 },
      { targetExternalId: "807", kind: "recommendation", weight: 0.5 },
    ]);
  });

  it("nulls out empty strings and zero runtime", () => {
    const { title, externalIds } = mapTmdbMovie({
      ...movie,
      overview: "",
      release_date: "",
      runtime: 0,
      external_ids: { imdb_id: null },
    });
    expect(title).toMatchObject({ overview: null, year: null, runtime: null });
    expect(externalIds).toHaveLength(1);
  });
});

describe("mapTmdbTv", () => {
  const tv = tvDetailsSchema.parse(tvFixture);

  it("maps details to a title row", () => {
    const entry = mapTmdbTv(tv);
    expect(entry.title).toMatchObject({
      type: "tv",
      title: "Game of Thrones",
      year: 2011,
      runtime: null,
      keywords: ["based on novel or book", "dragon"],
      maturity: "TV-MA",
    });
    expect(entry.externalIds).toEqual([
      { source: "tmdb_tv", externalId: "1399" },
      { source: "imdb", externalId: "tt0944947" },
    ]);
    expect(entry.relations).toEqual([
      { targetExternalId: "1402", kind: "recommendation", weight: 1 },
    ]);
  });

  it("uses the first episode runtime when present", () => {
    expect(mapTmdbTv({ ...tv, episode_run_time: [24, 30] }).title.runtime).toBe(24);
  });

  it("types Japanese animation as anime", () => {
    const animation = [{ id: 16, name: "Animation" }];
    expect(
      mapTmdbTv({ ...tv, genres: animation, original_language: "ja", origin_country: ["JP"] }).title
        .type,
    ).toBe("anime");
    expect(mapTmdbTv({ ...tv, genres: animation, original_language: "en" }).title.type).toBe("tv");
    expect(mapTmdbTv({ ...tv, original_language: "ja" }).title.type).toBe("tv");
  });
});

describe("helpers", () => {
  it("yearOf handles missing dates", () => {
    expect(yearOf("2011-04-17")).toBe(2011);
    expect(yearOf("")).toBeNull();
    expect(yearOf(undefined)).toBeNull();
  });

  it("pickCertification prefers a non-empty US rating", () => {
    expect(
      pickCertification([
        { region: "IN", value: "A" },
        { region: "US", value: "" },
        { region: "US", value: "PG-13" },
      ]),
    ).toBe("PG-13");
    expect(pickCertification([{ region: "IN", value: "U/A 13+" }])).toBe("U/A 13+");
    expect(pickCertification([{ region: "US", value: " " }])).toBeNull();
  });
});
