import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

// provider_id is TMDB's watch-provider id, the same one title_providers uses.
export const userServices = pgTable(
  "user_services",
  {
    userId: text("user_id").notNull(),
    region: text().notNull(),
    providerId: integer("provider_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.region, t.providerId] })],
);
