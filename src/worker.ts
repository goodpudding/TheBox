// Bundled by Wrangler after `opennextjs-cloudflare build`. Not part of the Next app.
// @ts-ignore `.open-next/worker.js` is generated at build time.
import { default as handler } from "../.open-next/worker.js";
import { useScheduledD1 } from "./lib/db";
import { runClassSync } from "./lib/sync/run";

type WorkerEnv = { DB?: Parameters<typeof useScheduledD1>[0] };

export default {
  fetch: handler.fetch,

  async scheduled(
    _event: unknown,
    env: WorkerEnv,
    ctx: { waitUntil: (promise: Promise<unknown>) => void },
  ) {
    ctx.waitUntil(
      (async () => {
        useScheduledD1(env.DB ?? null);
        try {
          const result = await runClassSync();
          console.info(JSON.stringify({ cron: "zeffy-classes", ...result }));
        } finally {
          useScheduledD1(null);
        }
      })(),
    );
  },
};

// Required when the app uses the DO queue or tag cache.
// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js";
