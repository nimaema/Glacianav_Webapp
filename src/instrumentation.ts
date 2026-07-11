export async function register() {
  const localProcessorExplicitlyEnabled = process.env.NOVA_PROCESSOR_ENABLED === "true";
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !process.env.DATABASE_URL ||
    (process.env.NODE_ENV !== "production" && !localProcessorExplicitlyEnabled) ||
    process.env.NOVA_PROCESSOR_DISABLED === "true"
  ) {
    return;
  }

  // This runs inside the existing web container, outside any browser request.
  // Long Nova tasks therefore continue after the enqueue response has closed
  // and do not depend on Cloudflare or a separately deployed coordinator.
  const { startNovaJobProcessor } = await import("@/lib/ai/nova-processor");
  startNovaJobProcessor();
}
