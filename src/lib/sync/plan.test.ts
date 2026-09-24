import { describe, expect, it } from "vitest";

import { batchTmdbIds, isAuthorizedCron, nextAniListPage, syncWindow, TMDB_BATCH } from "./plan";

describe("syncWindow", () => {
  it("looks back 36 hours", () => {
    const w = syncWindow(new Date("2026-09-25T03:00:00Z"));
    expect(w).toEqual({
      startDate: "2026-09-23",
      endDate: "2026-09-25",
      since: Date.parse("2026-09-23T15:00:00Z") / 1000,
    });
  });
});

describe("batchTmdbIds", () => {
  it("splits ids into batches without duplicates", () => {
    const ids = [...Array.from({ length: TMDB_BATCH + 5 }, (_, i) => i), 3, 4];
    const batches = batchTmdbIds("tv", ids);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual({ kind: "tmdb", type: "tv", ids: ids.slice(0, TMDB_BATCH) });
    expect(batches.flatMap((b) => (b.kind === "tmdb" ? b.ids : []))).toHaveLength(TMDB_BATCH + 5);
  });

  it("sends nothing for no changes", () => {
    expect(batchTmdbIds("movie", [])).toEqual([]);
  });
});

describe("nextAniListPage", () => {
  const since = 1000;

  it("continues while the page still ends inside the window", () => {
    expect(nextAniListPage(1, [{ updatedAt: 2000 }, { updatedAt: 1000 }], true, since)).toBe(2);
  });

  it("stops once the page reaches older updates or the last page", () => {
    expect(nextAniListPage(3, [{ updatedAt: 2000 }, { updatedAt: 999 }], true, since)).toBeNull();
    expect(nextAniListPage(3, [{ updatedAt: 2000 }], false, since)).toBeNull();
    expect(nextAniListPage(3, [], true, since)).toBeNull();
  });
});

describe("isAuthorizedCron", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedCron("Bearer wrong!", "s3cret")).toBe(false);
    expect(isAuthorizedCron("Bearer s3cre", "s3cret")).toBe(false);
    expect(isAuthorizedCron(null, "s3cret")).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});
