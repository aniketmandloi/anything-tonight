import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

export const titleType = pgEnum("title_type", ["movie", "tv", "anime"]);

// Changing either dimension means re-embedding or re-scoring every title.
export const EMBEDDING_DIMENSIONS = 1536;
export const MOOD_DIMENSIONS = 8;

export const titles = pgTable(
  "titles",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    type: titleType().notNull(),
    title: text().notNull(),
    originalTitle: text("original_title"),
    overview: text(),
    year: integer(),
    runtime: integer(),
    genres: text().array().notNull().default([]),
    keywords: text().array().notNull().default([]),
    originalLanguage: text("original_language"),
    maturity: text(),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    voteAvg: real("vote_avg"),
    voteCount: integer("vote_count"),
    popularity: real(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    // Hash of the model and text the embedding was made from; a mismatch means it's stale.
    embeddingHash: text("embedding_hash"),
    mood: vector({ dimensions: MOOD_DIMENSIONS }),
    moodTags: text("mood_tags").array().notNull().default([]),
    quality: real(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("titles_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("titles_type_popularity_idx").on(t.type, t.popularity),
    // Needs pg_trgm (migration 0010) and f_unaccent (0012); search must query the same expression.
    index("titles_title_trgm_idx").using("gin", sql`f_unaccent(${t.title}) gin_trgm_ops`),
    index("titles_original_title_trgm_idx").using(
      "gin",
      sql`f_unaccent(${t.originalTitle}) gin_trgm_ops`,
    ),
  ],
);
