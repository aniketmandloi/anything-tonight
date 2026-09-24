import { handleCallback } from "@vercel/queue";

import { db } from "@/db/client";
import type { SyncMessage } from "@/lib/sync/plan";
import { syncDeps } from "@/lib/sync/deps";
import { handleSyncMessage } from "@/lib/sync/run";

const MAX_DELIVERIES = 5;

export const POST = handleCallback<SyncMessage>(
  (message) => handleSyncMessage(db, message, syncDeps()),
  {
    // A title that keeps failing (e.g. deleted on TMDB) is dropped instead of retried until expiry.
    retry: (_error, metadata) =>
      metadata.deliveryCount >= MAX_DELIVERIES
        ? { acknowledge: true }
        : { afterSeconds: 60 * metadata.deliveryCount },
  },
);
