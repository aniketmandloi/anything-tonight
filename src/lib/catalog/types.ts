import type { externalSource, titles } from "@/db/schema";

export type ExternalSource = (typeof externalSource.enumValues)[number];

export type TitleFields = Omit<
  typeof titles.$inferInsert,
  "id" | "embedding" | "mood" | "quality" | "createdAt" | "updatedAt"
>;

export type ExternalRef = { source: ExternalSource; externalId: string };

// One title as produced by an ingest source, ready to upsert.
// externalIds[0] is the source's own id and identifies the title on re-runs;
// relation targets share that source. linkedIds are only used to find an existing
// title (the same anime from the other source) and are never written.
export type CatalogEntry = {
  title: TitleFields;
  externalIds: ExternalRef[];
  linkedIds?: ExternalRef[];
  relations: { targetExternalId: string; kind: string; weight: number | null }[];
};

export type IngestCounts = { upserted: number; aliased: number; skipped: number; failed: number };
