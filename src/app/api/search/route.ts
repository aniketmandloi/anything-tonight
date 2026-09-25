import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@/db/client";
import { titleType } from "@/db/schema";
import { searchTitles } from "@/lib/search/query";

const params = z.object({
  q: z.string().trim().min(2).max(100),
  type: z.enum(titleType.enumValues).optional(),
});

export async function GET(request: Request) {
  const parsed = params.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { q, type } = parsed.data;
  return Response.json({ results: await searchTitles(db, userId, q, { type }) });
}
