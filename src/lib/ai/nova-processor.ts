import "server-only";

import { processNextNovaJob } from "@/lib/ai/nova-jobs";

const IDLE_POLL_MS = 1_000;
const ERROR_BACKOFF_MS = 5_000;

declare global {
  var __glacianavNovaProcessorStarted: boolean | undefined;
}

function scheduleNext(delay: number) {
  const timer = setTimeout(async () => {
    try {
      const processed = await processNextNovaJob();
      scheduleNext(processed ? 0 : IDLE_POLL_MS);
    } catch (error) {
      console.error("Nova background processor failed; retrying.", error);
      scheduleNext(ERROR_BACKOFF_MS);
    }
  }, delay);

  // The processor must not keep build tools or a shutting-down server alive.
  timer.unref();
}

/** Starts one durable queue consumer per Node.js server process. */
export function startNovaJobProcessor() {
  if (globalThis.__glacianavNovaProcessorStarted) return;
  globalThis.__glacianavNovaProcessorStarted = true;
  scheduleNext(250);
}
