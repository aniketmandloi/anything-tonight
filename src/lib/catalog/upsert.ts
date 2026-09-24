import { and, eq } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleExternalIds, titleRelations, titles } from "@/db/schema";

import type { CatalogEntry, ExternalSource } from "./types";

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export async function findTitleId(
  db: typeof Db | Tx,
  source: ExternalSource,
  externalId: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ id: titleExternalIds.titleId })
    .from(titleExternalIds)
    .where(and(eq(titleExternalIds.source, source), eq(titleExternalIds.externalId, externalId)));
  return row?.id;
}

// Idempotent: the entry's own id (externalIds[0]) decides insert vs update, and its
// relations replace the ones previously written from the same source.
export async function upsertCatalogEntry(db: typeof Db, entry: CatalogEntry): Promise<number> {
  const [own] = entry.externalIds;

  return db.transaction(async (tx) => {
    let titleId = await findTitleId(tx, own.source, own.externalId);
    if (titleId === undefined) {
      [{ id: titleId }] = await tx.insert(titles).values(entry.title).returning({ id: titles.id });
    } else {
      await tx.update(titles).set(entry.title).where(eq(titles.id, titleId));
    }

    // An id already mapped to another title (e.g. a shared IMDb id) keeps its mapping.
    await tx
      .insert(titleExternalIds)
      .values(entry.externalIds.map((e) => ({ ...e, titleId })))
      .onConflictDoNothing();

    await tx
      .delete(titleRelations)
      .where(and(eq(titleRelations.titleId, titleId), eq(titleRelations.targetSource, own.source)));
    if (entry.relations.length > 0) {
      await tx
        .insert(titleRelations)
        .values(entry.relations.map((r) => ({ ...r, titleId, targetSource: own.source })))
        .onConflictDoNothing();
    }

    return titleId;
  });
}
