import { RATING_CHOICES, type UserTitleStatus } from "@/lib/library/choices";

export const SWIPE_ANSWERS = ["loved", "meh", "unseen", "dismissed"] as const;
export type SwipeAnswer = (typeof SWIPE_ANSWERS)[number];

export const MAX_FAVOURITES = 3;

export type UserTitleRow = { titleId: number; status: UserTitleStatus; rating: number | null };

// "unseen" writes nothing: the title stays a candidate for recommendations. Favourites count as
// loved and win over a swipe on the same title.
export function onboardingRows(
  answers: { titleId: number; answer: SwipeAnswer }[],
  favouriteIds: number[],
): UserTitleRow[] {
  const rows = new Map<number, UserTitleRow>();
  for (const { titleId, answer } of answers) {
    if (answer === "loved" || answer === "meh") {
      rows.set(titleId, { titleId, status: "watched", rating: RATING_CHOICES[answer].rating });
    } else if (answer === "dismissed") {
      rows.set(titleId, { titleId, status: "dismissed", rating: null });
    }
  }
  for (const titleId of favouriteIds) {
    rows.set(titleId, { titleId, status: "watched", rating: RATING_CHOICES.loved.rating });
  }
  return [...rows.values()];
}
