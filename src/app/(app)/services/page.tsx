import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import { ServicesPicker } from "@/components/services-picker";
import { db } from "@/db/client";
import { PROVIDER_REGIONS } from "@/lib/catalog/providers";
import { getUserServices, listRegionProviders } from "@/lib/services/queries";
import { pickRegion, regionName } from "@/lib/services/regions";

export default async function ServicesPage() {
  const { userId } = await auth.protect();
  const [providers, saved, requestHeaders] = await Promise.all([
    listRegionProviders(db),
    getUserServices(db, userId),
    headers(),
  ]);
  const region = pickRegion(saved?.region ?? null, requestHeaders.get("x-vercel-ip-country"));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Your services</h1>
        <p className="text-muted-foreground">Picks only include titles you can stream on these.</p>
      </div>
      <ServicesPicker
        regions={PROVIDER_REGIONS.map((code) => ({ code, name: regionName(code) }))}
        providers={providers}
        initialRegion={region}
        initialProviderIds={saved?.providerIds ?? []}
      />
    </main>
  );
}
