import { describe, expect, it } from "vitest";

import pageFixture from "@/lib/anilist/__fixtures__/media-page.json";
import { mediaPageSchema } from "@/lib/anilist/schemas";

import { cleanDescription, mapAniListMedia } from "./anilist-map";

const [aot] = mediaPageSchema.parse(pageFixture).data.Page.media;

describe("mapAniListMedia", () => {
  const entry = mapAniListMedia(aot);

  it("maps a live AniList record to a title row", () => {
    expect(entry.title).toMatchObject({
      type: "anime",
      title: "Attack on Titan",
      originalTitle: "進撃の巨人",
      year: 2013,
      runtime: 24,
      originalLanguage: "ja",
      voteAvg: 8.5,
      maturity: null,
    });
    expect(entry.title.voteCount).toBeGreaterThan(100_000);
    expect(entry.title.posterPath).toMatch(/^https:\/\/s4\.anilist\.co\//);
  });

  it("keeps strong, spoiler-free tags", () => {
    expect(entry.title.keywords).toContain("Kaiju");
    expect(entry.title.keywords).not.toContain("Tragedy"); // spoiler
    expect(entry.title.keywords).not.toContain("Adoption"); // rank 31
  });

  it("stores the AniList id first, then MAL", () => {
    expect(entry.externalIds).toEqual([
      { source: "anilist", externalId: "16498" },
      { source: "mal", externalId: "16498" },
    ]);
  });

  it("keeps anime relations and ranked recommendations, drops manga adaptations", () => {
    const kinds = entry.relations.map((r) => r.kind);
    expect(kinds).toContain("sequel");
    expect(kinds).toContain("prequel");
    expect(kinds).not.toContain("adaptation");
    const recs = entry.relations.filter((r) => r.kind === "recommendation");
    expect(recs).toHaveLength(10);
    expect(recs[0].weight).toBe(1);
  });

  it("falls back to romaji when there is no English title", () => {
    const e = mapAniListMedia({ ...aot, title: { english: null, romaji: "Shingeki no Kyojin" } });
    expect(e.title.title).toBe("Shingeki no Kyojin");
  });
});

describe("cleanDescription", () => {
  it("turns breaks into newlines and drops the source credit", () => {
    const text = cleanDescription(aot.description);
    expect(text).toMatch(/^Several hundred years ago/);
    expect(text).toContain("titans.\n\nFlash forward");
    expect(text).not.toMatch(/<br>|Source:|\r/);
  });

  it("strips other tags and decodes entities", () => {
    expect(cleanDescription("<i>Tom &amp; Jerry</i> &quot;run&quot;<br>")).toBe('Tom & Jerry "run"');
    expect(cleanDescription("")).toBeNull();
    expect(cleanDescription("<br>")).toBeNull();
  });
});
