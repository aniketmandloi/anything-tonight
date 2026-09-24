import { describe, expect, it } from "vitest";

import movieFixture from "@/lib/tmdb/__fixtures__/movie-550.json";
import { movieDetailsSchema } from "@/lib/tmdb/schemas";

import { mapTmdbMovie, pickCertification, yearOf } from "./tmdb-map";

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
