import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { db } from "@/db/client";
import { PROVIDER_REGIONS } from "@/lib/catalog/providers";
import { buildOnboardingDeck } from "@/lib/onboarding/deck";
import { getUserServices, listRegionProviders } from "@/lib/services/queries";
import { pickRegion, regionName } from "@/lib/services/regions";

export default async function OnboardingPage() {
  const { userId } = await auth.protect();
  const [providers, saved, cards, requestHeaders] = await Promise.all([
    listRegionProviders(db),
    getUserServices(db, userId),
    buildOnboardingDeck(db, userId),
    headers(),
  ]);

  return (
    <OnboardingFlow
      regions={PROVIDER_REGIONS.map((code) => ({ code, name: regionName(code) }))}
      providers={providers}
      initialRegion={pickRegion(saved?.region ?? null, requestHeaders.get("x-vercel-ip-country"))}
      initialProviderIds={saved?.providerIds ?? []}
      cards={cards}
    />
  );
}
