import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { titles } from "./titles";

export const userTitleStatus = pgEnum("user_title_status", [
  "watched",
  "watching",
  "want",
  "dismissed",
]);

// user_id is the Clerk user id; there is no local users table.
export const userTitles = pgTable(
  "user_titles",
  {
    userId: text("user_id").notNull(),
    titleId: integer("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    status: userTitleStatus().notNull(),
    // -2 (hated) to 2 (loved); null when the user hasn't rated it.
    rating: smallint(),
    // Where the row came from, e.g. "manual", "onboarding", or an import such as "letterboxd".
    source: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.titleId] }),
    index("user_titles_title_id_idx").on(t.titleId),
    check("user_titles_rating_range", sql`${t.rating} between -2 and 2`),
  ],
);
