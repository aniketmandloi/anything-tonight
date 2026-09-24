import { send } from "@vercel/queue";

import { db } from "@/db/client";
import { isAuthorizedCron, SYNC_TOPIC, syncWindow } from "@/lib/sync/plan";
import { tmdbFromEnv } from "@/lib/sync/deps";
import { planNightlySync } from "@/lib/sync/run";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const window = syncWindow(new Date());
  const messages = await planNightlySync(db, tmdbFromEnv(), window);
  // Keys make a retried cron run within the day a no-op instead of a second fan-out.
  await Promise.all(
    messages.map((message, i) =>
      send(SYNC_TOPIC, message, { idempotencyKey: `sync:${window.endDate}:${i}` }),
    ),
  );
  return Response.json({ window, messages: messages.length });
}
