"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";

import { RATING_CHOICE_KEYS, type RatingChoice } from "./choices";
import { removeTitle, setChoice } from "./user-titles";

const rateInput = z.object({
  titleId: z.number().int().positive(),
  choice: z.enum(RATING_CHOICE_KEYS).nullable(),
});

// A null choice removes the title from the library.
export async function rateTitle(titleId: number, choice: RatingChoice | null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const input = rateInput.parse({ titleId, choice });
  if (input.choice) await setChoice(db, userId, input.titleId, input.choice, "manual");
  else await removeTitle(db, userId, input.titleId);
  revalidatePath("/library");
}
