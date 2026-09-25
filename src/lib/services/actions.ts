"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";

import { listRegionProviders, saveUserServices } from "./queries";
import { isSupportedRegion } from "./regions";

const servicesInput = z.object({
  region: z.string().refine(isSupportedRegion, "Unsupported region"),
  providerIds: z.array(z.number().int().positive()).max(100),
});

export async function saveServices(region: string, providerIds: number[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const input = servicesInput.parse({ region, providerIds });
  // Only keep providers we actually list for the region, so stale or forged ids can't be saved.
  const known = new Set((await listRegionProviders(db))[input.region].map((p) => p.id));
  await saveUserServices(db, userId, input.region, [...new Set(input.providerIds)].filter((id) => known.has(id)));
  revalidatePath("/services");
}
