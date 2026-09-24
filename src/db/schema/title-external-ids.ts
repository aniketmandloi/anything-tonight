import { index, integer, pgEnum, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { titles } from "./titles";

// TMDB movie and TV ids share one number space but name different titles, so they are separate sources.
export const externalSource = pgEnum("external_source", [
  "tmdb_movie",
  "tmdb_tv",
  "anilist",
  "mal",
  "imdb",
]);

export const titleExternalIds = pgTable(
  "title_external_ids",
  {
    source: externalSource().notNull(),
    externalId: text("external_id").notNull(),
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.externalId] }),
    index("title_external_ids_title_id_idx").on(t.titleId),
  ],
);
