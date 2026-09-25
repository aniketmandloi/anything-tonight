import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titles, userTitles } from "@/db/schema";
import { imageUrl } from "@/lib/catalog/images";
import type { TitleType } from "@/lib/search/query";

import { choiceFor, RATING_CHOICES, type RatingChoice } from "./choices";

// source is kept from the first insert: it records where the title entered the library.
export async function setChoice(
  db: typeof Db,
  userId: string,
  titleId: number,
  choice: RatingChoice,
  source: string,
) {
  const { status, rating } = RATING_CHOICES[choice];
  await db
    .insert(userTitles)
    .values({ userId, titleId, status, rating, source })
    .onConflictDoUpdate({
      target: [userTitles.userId, userTitles.titleId],
      set: { status, rating, updatedAt: sql`now()` },
    });
}

export async function removeTitle(db: typeof Db, userId: string, titleId: number) {
  await db.delete(userTitles).where(and(eq(userTitles.userId, userId), eq(userTitles.titleId, titleId)));
}

export type LibraryEntry = {
  id: number;
  type: TitleType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  choice: RatingChoice | null;
};

export async function listLibrary(db: typeof Db, userId: string): Promise<LibraryEntry[]> {
  const rows = await db
    .select({
      id: titles.id,
      type: titles.type,
      title: titles.title,
      year: titles.year,
      posterPath: titles.posterPath,
      status: userTitles.status,
      rating: userTitles.rating,
    })
    .from(userTitles)
    .innerJoin(titles, eq(titles.id, userTitles.titleId))
    .where(and(eq(userTitles.userId, userId), inArray(userTitles.status, ["watched", "want"])))
    .orderBy(desc(userTitles.updatedAt));

  return rows.map(({ posterPath, status, rating, ...r }) => ({
    ...r,
    posterUrl: imageUrl(posterPath, "w185"),
    choice: choiceFor(status, rating),
  }));
}
