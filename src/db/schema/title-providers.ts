import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { titles } from "./titles";

export const monetization = pgEnum("monetization", ["flatrate", "free", "ads", "rent", "buy"]);

export const titleProviders = pgTable(
  "title_providers",
  {
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    region: text().notNull(),
    providerId: integer("provider_id").notNull(),
    providerName: text("provider_name").notNull(),
    logoPath: text("logo_path"),
    monetization: monetization().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.titleId, t.region, t.providerId, t.monetization] }),
    index("title_providers_region_provider_idx").on(t.region, t.providerId),
  ],
);
