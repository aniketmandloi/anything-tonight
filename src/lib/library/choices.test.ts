import { describe, expect, it } from "vitest";

import { choiceFor, RATING_CHOICE_KEYS, RATING_CHOICES } from "./choices";

describe("choiceFor", () => {
  it("round-trips every choice", () => {
    for (const key of RATING_CHOICE_KEYS) {
      const { status, rating } = RATING_CHOICES[key];
      expect(choiceFor(status, rating)).toBe(key);
    }
  });

  it("shows an imported -2 as disliked", () => {
    expect(choiceFor("watched", -2)).toBe("disliked");
  });

  it("has no choice for rows the buttons can't describe", () => {
    expect(choiceFor("watched", null)).toBeNull();
    expect(choiceFor("watching", 2)).toBeNull();
    expect(choiceFor("dismissed", null)).toBeNull();
  });
});
