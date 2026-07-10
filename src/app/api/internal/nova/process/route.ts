import { processNextNovaJob } from "@/lib/ai/nova-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.NOVA_INTERNAL_SECRET || process.env.NOVA_CONFIRMATION_SECRET;
  if (!secret) return Response.json({ error: "Nova orchestrator secret is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const processed = await processNextNovaJob();
  return Response.json({ processed });
}
