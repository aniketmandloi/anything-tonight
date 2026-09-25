"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db/client";
import { setUserTitles } from "@/lib/library/user-titles";

import { MAX_FAVOURITES, onboardingRows, SWIPE_ANSWERS, type SwipeAnswer } from "./answers";
import { DECK_SIZE } from "./deck";

const titleId = z.number().int().positive();
const onboardingInput = z.object({
  answers: z.array(z.object({ titleId, answer: z.enum(SWIPE_ANSWERS) })).max(DECK_SIZE),
  favouriteIds: z.array(titleId).max(MAX_FAVOURITES),
});

export async function completeOnboarding(
  answers: { titleId: number; answer: SwipeAnswer }[],
  favouriteIds: number[],
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  const input = onboardingInput.parse({ answers, favouriteIds });
  await setUserTitles(db, userId, onboardingRows(input.answers, input.favouriteIds), "onboarding");
  redirect("/tonight");
}
