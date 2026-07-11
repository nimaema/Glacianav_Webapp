import "server-only";

import { processNextNovaJob } from "@/lib/ai/nova-jobs";

const IDLE_POLL_MS = 1_000;
const ERROR_BACKOFF_MS = 5_000;
const DEFAULT_CONCURRENCY = 3;

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
  const configured = Number(process.env.NOVA_PROCESSOR_CONCURRENCY ?? DEFAULT_CONCURRENCY);
  const concurrency = Number.isFinite(configured)
    ? Math.min(6, Math.max(1, Math.floor(configured)))
    : DEFAULT_CONCURRENCY;
  for (let lane = 0; lane < concurrency; lane += 1) {
    scheduleNext(250 + lane * 100);
  }
}
