import { eq } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleProviders } from "@/db/schema";
import type { WatchProviders } from "@/lib/tmdb/schemas";

// Every region multiplies provider rows (~50 regions on TMDB); add one here to support its users.
export const PROVIDER_REGIONS = ["US", "IN", "GB", "CA", "AU"];

const MONETIZATIONS = ["flatrate", "free", "ads", "rent", "buy"] as const;

export type ProviderRow = Omit<typeof titleProviders.$inferInsert, "titleId" | "updatedAt">;

export function mapProviders(wp: WatchProviders): ProviderRow[] {
  const rows = new Map<string, ProviderRow>();
  for (const region of PROVIDER_REGIONS) {
    const byType = wp.results[region];
    if (!byType) continue;
    for (const monetization of MONETIZATIONS) {
      for (const p of byType[monetization] ?? []) {
        rows.set(`${region}:${p.provider_id}:${monetization}`, {
          region,
          providerId: p.provider_id,
          providerName: p.provider_name,
          logoPath: p.logo_path ?? null,
          monetization,
        });
      }
    }
  }
  return [...rows.values()];
}

// Replaces rather than upserts, so a title that leaves a service stops showing it.
export async function replaceTitleProviders(db: typeof Db, titleId: number, rows: ProviderRow[]) {
  await db.transaction(async (tx) => {
    await tx.delete(titleProviders).where(eq(titleProviders.titleId, titleId));
    if (rows.length > 0) {
      await tx.insert(titleProviders).values(rows.map((r) => ({ ...r, titleId })));
    }
  });
}
