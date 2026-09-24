import { integer, pgTable, primaryKey, real, text } from "drizzle-orm/pg-core";

import { externalSource } from "./title-external-ids";
import { titles } from "./titles";

// Targets are external ids, not title ids: a recommended title is often not ingested yet.
// Resolve them by joining title_external_ids on (target_source, target_external_id).
export const titleRelations = pgTable(
  "title_relations",
  {
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    targetSource: externalSource("target_source").notNull(),
    targetExternalId: text("target_external_id").notNull(),
    // "recommendation", or an AniList relation type such as "sequel".
    kind: text().notNull(),
    weight: real(),
  },
  (t) => [primaryKey({ columns: [t.titleId, t.targetSource, t.targetExternalId, t.kind] })],
);
