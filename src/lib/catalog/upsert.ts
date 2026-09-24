import { and, eq, getTableColumns } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleExternalIds, titleRelations, titles } from "@/db/schema";

import { familyOf, mergeSharedTitle } from "./anime-merge";
import type { CatalogEntry, ExternalSource, TitleFields } from "./types";

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

const NOT_FIELDS = new Set(["id", "embedding", "mood", "quality", "createdAt", "updatedAt"]);
const fieldColumns = Object.fromEntries(
  Object.entries(getTableColumns(titles)).filter(([key]) => !NOT_FIELDS.has(key)),
);

export async function readTitleFields(db: typeof Db | Tx, id: number): Promise<TitleFields> {
  const [row] = await db.select(fieldColumns).from(titles).where(eq(titles.id, id));
  return row as TitleFields;
}

// Idempotent: the entry's own id (externalIds[0]), then its linkedIds, decide insert vs update,
// and its relations replace the ones previously written from the same source. A title that
// already carries ids from the other source family is merged by field ownership, not overwritten.
export async function upsertCatalogEntry(db: typeof Db, entry: CatalogEntry): Promise<number> {
  const [own] = entry.externalIds;
  const ownFamily = familyOf(own.source);

  return db.transaction(async (tx) => {
    let titleId: number | undefined;
    for (const ref of [own, ...(entry.linkedIds ?? [])]) {
      titleId = await findTitleId(tx, ref.source, ref.externalId);
      if (titleId !== undefined) break;
    }

    if (titleId === undefined) {
      [{ id: titleId }] = await tx.insert(titles).values(entry.title).returning({ id: titles.id });
    } else {
      const sources = await tx
        .select({ source: titleExternalIds.source })
        .from(titleExternalIds)
        .where(eq(titleExternalIds.titleId, titleId));
      const shared =
        ownFamily !== null &&
        sources.some((s) => {
          const family = familyOf(s.source);
          return family !== null && family !== ownFamily;
        });
      const fields = shared
        ? mergeSharedTitle(await readTitleFields(tx, titleId), entry.title, ownFamily)
        : entry.title;
      await tx.update(titles).set(fields).where(eq(titles.id, titleId));
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
