// Bundled by Wrangler after `opennextjs-cloudflare build`. Not part of the Next app.
// The import below only exists after the OpenNext build, so it cannot be
// @ts-expect-error: that would fail once the file is there.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time.
import { default as handler } from "../.open-next/worker.js";
import { useScheduledD1 } from "./lib/db";
import { runClassSync } from "./lib/sync/run";
import { prunePinRows } from "./lib/workstation/pin-throttle";

type WorkerEnv = { DB?: Parameters<typeof useScheduledD1>[0] };

const worker = {
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
          // Never throws: a failed prune must not stop the class sync.
          const pruned = await prunePinRows();
          if (pruned > 0) console.info(JSON.stringify({ cron: "pin-rows", pruned }));
          const result = await runClassSync();
          console.info(JSON.stringify({ cron: "zeffy-classes", ...result }));
        } finally {
          useScheduledD1(null);
        }
      })(),
    );
  },
};

export default worker;

// Required when the app uses the DO queue or tag cache.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js";
