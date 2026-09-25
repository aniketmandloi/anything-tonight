import { describe, expect, it } from "vitest";

import { imageUrl } from "./images";

describe("imageUrl", () => {
  it("prefixes a TMDB relative path with the sized image base", () => {
    expect(imageUrl("/abc.jpg", "w342")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
  });

  it("returns AniList full URLs unchanged", () => {
    const url = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg";
    expect(imageUrl(url, "w342")).toBe(url);
  });

  it("returns null without a path", () => {
    expect(imageUrl(null, "w92")).toBeNull();
  });
});
