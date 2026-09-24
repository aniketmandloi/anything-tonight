import { describe, expect, it } from "vitest";

import { parseFribb } from "./anime-id-map";

// Shapes as they appear in Fribb/anime-lists (Attack on Titan's TMDB show has 9 AniList entries).
const fribb = [
  { anilist_id: 18397, mal_id: 18397, themoviedb_id: { tv: 1429 }, season: { tvdb: 0, tmdb: 0 } },
  { anilist_id: 20958, mal_id: 25777, themoviedb_id: { tv: 1429 }, season: { tvdb: 2, tmdb: 2 } },
  { anilist_id: 16498, mal_id: 16498, themoviedb_id: { tv: 1429 }, season: { tvdb: 1, tmdb: 1 } },
  { anilist_id: 199, mal_id: 199, themoviedb_id: { movie: [129] } },
  { anilist_id: 11441, themoviedb_id: { movie: [145675, 210227] } },
  { anilist_id: 500, themoviedb_id: { tv: 77 }, season: { tvdb: 3 } },
  { anilist_id: 400, themoviedb_id: { tv: 77 }, season: { tvdb: 2 } },
  { anidb_id: 1, mal_id: 1 },
  { anilist_id: 9, mal_id: 9 },
  "not an object",
];

describe("parseFribb", () => {
  const rows = parseFribb(fribb);
  const byId = (id: number) => rows.find((r) => r.anilistId === id);

  it("keeps only entries with both an AniList and a TMDB id", () => {
    expect(rows.map((r) => r.anilistId).sort((a, b) => a - b)).toEqual([
      199, 400, 500, 11441, 16498, 18397, 20958,
    ]);
  });

  it("maps tv and movie ids to their sources", () => {
    expect(byId(16498)).toMatchObject({ tmdbSource: "tmdb_tv", tmdbId: "1429", tmdbSeason: 1, malId: 16498 });
    expect(byId(199)).toMatchObject({ tmdbSource: "tmdb_movie", tmdbId: "129", tmdbSeason: null });
    expect(byId(500)?.malId).toBeNull();
    expect(byId(11441)?.tmdbId).toBe("145675");
  });

  it("marks season 1 canonical over specials and later seasons", () => {
    expect(byId(16498)?.canonical).toBe(true);
    expect(byId(18397)?.canonical).toBe(false);
    expect(byId(20958)?.canonical).toBe(false);
    expect(byId(199)?.canonical).toBe(true);
  });

  it("falls back to the lowest AniList id when no entry has a TMDB season", () => {
    expect(byId(400)?.canonical).toBe(true);
    expect(byId(500)?.canonical).toBe(false);
  });
});
