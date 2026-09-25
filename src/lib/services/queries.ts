import { and, asc, countDistinct, desc, eq, inArray, min } from "drizzle-orm";

import type { db as Db } from "@/db/client";
import { titleProviders, userServices } from "@/db/schema";
import { imageUrl } from "@/lib/catalog/images";
import { PROVIDER_REGIONS } from "@/lib/catalog/providers";

// Services you can have: subscriptions and free/ad-supported. Rent and buy stores aren't.
const SERVICE_MONETIZATIONS = ["flatrate", "free", "ads"] as const;

export type Provider = { id: number; name: string; logoUrl: string | null };

// Providers per region, those carrying the most catalog titles first.
export async function listRegionProviders(db: typeof Db): Promise<Record<string, Provider[]>> {
  const titleCount = countDistinct(titleProviders.titleId);
  // A provider's name and logo can differ between title rows; any one of them will do.
  const name = min(titleProviders.providerName);
  const rows = await db
    .select({
      region: titleProviders.region,
      id: titleProviders.providerId,
      name,
      logoPath: min(titleProviders.logoPath),
      titleCount,
    })
    .from(titleProviders)
    .where(
      and(
        inArray(titleProviders.region, PROVIDER_REGIONS),
        inArray(titleProviders.monetization, [...SERVICE_MONETIZATIONS]),
      ),
    )
    .groupBy(titleProviders.region, titleProviders.providerId)
    .orderBy(desc(titleCount), asc(name));

  const byRegion: Record<string, Provider[]> = Object.fromEntries(PROVIDER_REGIONS.map((r) => [r, []]));
  for (const r of rows) {
    byRegion[r.region].push({ id: r.id, name: r.name ?? "", logoUrl: imageUrl(r.logoPath, "w92") });
  }
  return byRegion;
}

export type UserServices = { region: string; providerIds: number[] };

// Region lives on the service rows, so a user with no services has no saved region.
export async function getUserServices(db: typeof Db, userId: string): Promise<UserServices | null> {
  const rows = await db
    .select({ region: userServices.region, providerId: userServices.providerId })
    .from(userServices)
    .where(eq(userServices.userId, userId));
  if (rows.length === 0) return null;
  return { region: rows[0].region, providerIds: rows.map((r) => r.providerId) };
}

// Replaces every row, so switching region drops the old region's services.
export async function saveUserServices(
  db: typeof Db,
  userId: string,
  region: string,
  providerIds: number[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(userServices).where(eq(userServices.userId, userId));
    if (providerIds.length > 0) {
      await tx.insert(userServices).values(providerIds.map((providerId) => ({ userId, region, providerId })));
    }
  });
}
