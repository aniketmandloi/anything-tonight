import { and, desc, eq, or, sql } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titles, titleType } from "@/db/schema";
import { imageUrl } from "@/lib/catalog/images";

import { rankSearchResults } from "./rank";

export type TitleType = (typeof titleType.enumValues)[number];

export type SearchResult = {
  id: number;
  type: TitleType;
  title: string;
  year: number | null;
  posterUrl: string | null;
};

// Trigram similarity picks the candidates; rankSearchResults orders the final page.
const CANDIDATES = 50;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function searchTitles(
  db: typeof Db,
  query: string,
  { type, limit = 20 }: { type?: TitleType; limit?: number } = {},
): Promise<SearchResult[]> {
  // f_unaccent on both sides so "shippuden" finds "Shippūden"; the column side must match the
  // trigram index expressions on titles.
  const q = sql`f_unaccent(${query})`;
  const title = sql`f_unaccent(${titles.title})`;
  const originalTitle = sql`f_unaccent(${titles.originalTitle})`;
  const pattern = sql`f_unaccent(${`%${escapeLike(query)}%`})`;
  const similarity = sql<number>`greatest(
    word_similarity(${q}, ${title}),
    coalesce(word_similarity(${q}, ${originalTitle}), 0)
  )`;

  const rows = await db
    .select({
      id: titles.id,
      type: titles.type,
      title: titles.title,
      originalTitle: titles.originalTitle,
      year: titles.year,
      posterPath: titles.posterPath,
      quality: titles.quality,
      similarity,
    })
    .from(titles)
    .where(
      and(
        type ? eq(titles.type, type) : undefined,
        // <% (word similarity above pg_trgm's threshold) catches typos; ilike catches short prefixes.
        or(
          sql`${q} <% ${title}`,
          sql`${q} <% ${originalTitle}`,
          sql`${title} ilike ${pattern}`,
          sql`${originalTitle} ilike ${pattern}`,
        ),
      ),
    )
    .orderBy(desc(similarity))
    .limit(CANDIDATES);

  return rankSearchResults(query, rows)
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      year: r.year,
      posterUrl: imageUrl(r.posterPath, "w92"),
    }));
}
