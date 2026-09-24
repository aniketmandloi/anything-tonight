import type { externalSource, titles } from "@/db/schema";

export type ExternalSource = (typeof externalSource.enumValues)[number];

export type TitleFields = Omit<
  typeof titles.$inferInsert,
  "id" | "embedding" | "mood" | "quality" | "createdAt" | "updatedAt"
>;

// One title as produced by an ingest source, ready to upsert.
// externalIds[0] is the source's own id and identifies the title on re-runs;
// relation targets share that source.
export type CatalogEntry = {
  title: TitleFields;
  externalIds: { source: ExternalSource; externalId: string }[];
  relations: { targetExternalId: string; kind: string; weight: number | null }[];
};
