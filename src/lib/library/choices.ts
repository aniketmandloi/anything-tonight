import type { userTitleStatus } from "@/db/schema";

export type UserTitleStatus = (typeof userTitleStatus.enumValues)[number];

// What the user picks in the UI; each maps to a status and a rating on the -2..2 scale.
// -2 is left for imports with a harsher bottom rung (e.g. a 1-star Letterboxd review).
export const RATING_CHOICES = {
  loved: { status: "watched", rating: 2, label: "Loved" },
  liked: { status: "watched", rating: 1, label: "Liked" },
  meh: { status: "watched", rating: 0, label: "Meh" },
  disliked: { status: "watched", rating: -1, label: "Disliked" },
  want: { status: "want", rating: null, label: "Want" },
} as const satisfies Record<string, { status: UserTitleStatus; rating: number | null; label: string }>;

export type RatingChoice = keyof typeof RATING_CHOICES;

export const RATING_CHOICE_KEYS = Object.keys(RATING_CHOICES) as RatingChoice[];

// The inverse, for showing a stored row as a choice. Ratings between rungs (e.g. -2 from an
// import) round to the nearest choice; rows no choice describes (watching, dismissed,
// unrated watched) have none.
export function choiceFor(status: UserTitleStatus, rating: number | null): RatingChoice | null {
  if (status === "want") return "want";
  if (status !== "watched" || rating == null) return null;
  if (rating >= 2) return "loved";
  if (rating >= 1) return "liked";
  if (rating >= 0) return "meh";
  return "disliked";
}
