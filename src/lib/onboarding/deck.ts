import { inArray, sql } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleExternalIds, titles, userTitles } from "@/db/schema";
import { genreVectors, selectOnboardingTitles, type OnboardingCandidate } from "@/engine/onboarding";
import { imageUrl } from "@/lib/catalog/images";
import type { TitleType } from "@/lib/search/query";

// The most recognizable titles of each type that the selector clusters.
const POOL_PER_TYPE = 150;
export const DECK_SIZE = 20;

type PoolRow = { id: number; type: string; genres: string[]; embedding: string | null; weight: number };

export async function loadOnboardingCandidates(db: typeof Db, userId: string): Promise<OnboardingCandidate[]> {
  // weight = popularity percentile within the same pools as titles.quality (type + vote source),
  // because TMDB and AniList popularity aren't on the same scale.
  const { rows } = await db.execute<PoolRow>(sql`
    select id, type, genres, embedding, weight from (
      select *, row_number() over (partition by type order by weight desc, id) as rn from (
        select ${titles.id} as id, ${titles.type} as type, ${titles.genres} as genres,
          ${titles.embedding}::text as embedding,
          percent_rank() over (
            partition by ${titles.type}, exists (
              select 1 from ${titleExternalIds}
              where ${titleExternalIds.titleId} = ${titles.id}
                and ${titleExternalIds.source} in ('tmdb_movie', 'tmdb_tv')
            )
            order by ${titles.popularity} nulls first
          ) as weight
        from ${titles}
        where ${titles.posterPath} is not null
          and not exists (
            select 1 from ${userTitles}
            where ${userTitles.userId} = ${userId} and ${userTitles.titleId} = ${titles.id}
          )
      ) pooled
    ) ranked
    where rn <= ${POOL_PER_TYPE}
  `);

  // Embeddings and genre vectors live in different spaces, so it's all one or all the other.
  const useEmbeddings = rows.length > 0 && rows.every((r) => r.embedding != null);
  const vectors = useEmbeddings ? rows.map((r) => JSON.parse(r.embedding!) as number[]) : genreVectors(rows);
  return rows.map((r, i) => ({ id: r.id, type: r.type, weight: r.weight, vector: vectors[i] }));
}

// FNV-1a, so each user gets a stable deck across reloads.
function seedFor(userId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export type OnboardingCard = {
  id: number;
  type: TitleType;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
};

export async function buildOnboardingDeck(db: typeof Db, userId: string): Promise<OnboardingCard[]> {
  const ids = selectOnboardingTitles(await loadOnboardingCandidates(db, userId), {
    count: DECK_SIZE,
    seed: seedFor(userId),
  });
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: titles.id,
      type: titles.type,
      title: titles.title,
      year: titles.year,
      overview: titles.overview,
      posterPath: titles.posterPath,
    })
    .from(titles)
    .where(inArray(titles.id, ids));
  const byId = new Map(rows.map(({ posterPath, ...r }) => [r.id, { ...r, posterUrl: imageUrl(posterPath, "w342") }]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
