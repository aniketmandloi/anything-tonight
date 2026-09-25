import { PROVIDER_REGIONS } from "@/lib/catalog/providers";

export const DEFAULT_REGION = "US";

export const isSupportedRegion = (region: string | null | undefined): region is string =>
  region != null && PROVIDER_REGIONS.includes(region);

// A saved choice wins; otherwise guess from the visitor's IP country (Vercel's
// x-vercel-ip-country header), falling back to the US for regions we have no providers for.
export function pickRegion(saved: string | null, ipCountry: string | null): string {
  if (isSupportedRegion(saved)) return saved;
  const guess = ipCountry?.toUpperCase();
  return isSupportedRegion(guess) ? guess : DEFAULT_REGION;
}

export function regionName(region: string): string {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
}
