import {
  getNovaJobForUser,
  requestNovaJobCancellation,
} from "@/lib/ai/nova-jobs";
import { getCurrentProfile } from "@/lib/data/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile?.active) return Response.json({ error: "Sign in to view this Nova task." }, { status: 401 });
  const { id } = await params;
  const job = await getNovaJobForUser(id, profile);
  return job
    ? Response.json(job, { headers: { "Cache-Control": "private, no-store" } })
    : Response.json({ error: "Nova task not found." }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile?.active) return Response.json({ error: "Sign in to cancel this Nova task." }, { status: 401 });
  const { id } = await params;
  await requestNovaJobCancellation(id, profile.id);
  return Response.json({ ok: true });
}
