import { describe, expect, it } from "vitest";

import { onboardingRows } from "./answers";

describe("onboardingRows", () => {
  it("maps swipes to watched ratings and dismissals, skipping unseen", () => {
    expect(
      onboardingRows(
        [
          { titleId: 1, answer: "loved" },
          { titleId: 2, answer: "meh" },
          { titleId: 3, answer: "unseen" },
          { titleId: 4, answer: "dismissed" },
        ],
        [],
      ),
    ).toEqual([
      { titleId: 1, status: "watched", rating: 2 },
      { titleId: 2, status: "watched", rating: 0 },
      { titleId: 4, status: "dismissed", rating: null },
    ]);
  });

  it("adds favourites as loved, overriding a swipe on the same title", () => {
    expect(onboardingRows([{ titleId: 1, answer: "dismissed" }], [1, 9])).toEqual([
      { titleId: 1, status: "watched", rating: 2 },
      { titleId: 9, status: "watched", rating: 2 },
    ]);
  });
});
