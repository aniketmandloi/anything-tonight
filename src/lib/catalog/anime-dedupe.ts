import { eq, sql } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleExternalIds, titles } from "@/db/schema";

import { mergeSharedTitle } from "./anime-merge";
import { readTitleFields } from "./upsert";

// Moves everything attached to `fromId` onto `intoId` and deletes `fromId`. With `mergeFields`,
// `fromId`'s AniList-owned fields are merged into `intoId` first.
export async function absorbTitle(db: typeof Db, fromId: number, intoId: number, mergeFields: boolean) {
  await db.transaction(async (tx) => {
    if (mergeFields) {
      const merged = mergeSharedTitle(
        await readTitleFields(tx, intoId),
        await readTitleFields(tx, fromId),
        "anilist",
      );
      await tx.update(titles).set(merged).where(eq(titles.id, intoId));
    }
    await tx
      .update(titleExternalIds)
      .set({ titleId: intoId })
      .where(eq(titleExternalIds.titleId, fromId));
    await tx.execute(sql`
      insert into title_relations (title_id, target_source, target_external_id, kind, weight)
      select ${intoId}, target_source, target_external_id, kind, weight
      from title_relations where title_id = ${fromId}
      on conflict do nothing`);
    await tx.execute(sql`
      insert into title_providers (title_id, region, provider_id, provider_name, logo_path, monetization, updated_at)
      select ${intoId}, region, provider_id, provider_name, logo_path, monetization, updated_at
      from title_providers where title_id = ${fromId}
      on conflict do nothing`);
    await tx.delete(titles).where(eq(titles.id, fromId));
  });
}

// One-off cleanup for titles ingested before the mapping existed (and after a mapping refresh):
// every AniList title whose show already has a title is folded into it.
export async function dedupeAnime(db: typeof Db) {
  const { rows } = await db.execute<{ from_id: number; into_id: number; canonical: boolean }>(sql`
    select a.title_id as from_id, coalesce(tm.title_id, ca.title_id) as into_id, m.canonical
    from anime_id_map m
    join title_external_ids a on a.source = 'anilist' and a.external_id = m.anilist_id::text
    left join title_external_ids tm on tm.source = m.tmdb_source and tm.external_id = m.tmdb_id
    left join anime_id_map c on c.tmdb_source = m.tmdb_source and c.tmdb_id = m.tmdb_id and c.canonical
    left join title_external_ids ca on ca.source = 'anilist' and ca.external_id = c.anilist_id::text
    where coalesce(tm.title_id, ca.title_id) <> a.title_id
    order by m.canonical desc`);

  let merged = 0;
  let aliased = 0;
  const absorbed = new Set<number>();
  for (const { from_id, into_id, canonical } of rows) {
    if (absorbed.has(from_id)) continue;
    absorbed.add(from_id);
    await absorbTitle(db, from_id, into_id, canonical);
    if (canonical) merged++;
    else aliased++;
  }

  const retyped = await db.execute(sql`
    update titles set type = 'anime'
    where type <> 'anime' and id in (
      select e.title_id from title_external_ids e
      join anime_id_map m on e.source = m.tmdb_source and e.external_id = m.tmdb_id)`);

  return { merged, aliased, retyped: retyped.rowCount ?? 0 };
}

// Shows that still have more than one title; should be empty after dedupeAnime.
export async function findDuplicateAnime(db: typeof Db) {
  const { rows } = await db.execute<{ tmdb_source: string; tmdb_id: string; titles: number }>(sql`
    select m.tmdb_source, m.tmdb_id, count(distinct e.title_id)::int as titles
    from anime_id_map m
    join title_external_ids e
      on (e.source = 'anilist' and e.external_id = m.anilist_id::text)
      or (e.source = m.tmdb_source and e.external_id = m.tmdb_id)
    group by m.tmdb_source, m.tmdb_id
    having count(distinct e.title_id) > 1`);
  return rows;
}
