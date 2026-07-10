import { createNovaJob } from "@/lib/ai/nova-jobs";
import { getCurrentProfile } from "@/lib/data/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 40 * 1024 * 1024;

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active) return Response.json({ error: "Sign in to use Nova." }, { status: 401 });

  const form = await request.formData();
  const question = String(form.get("message") ?? "").replace(/\0/g, "").trim().slice(0, 12_000);
  const fileValue = form.get("file");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!question && !file) return Response.json({ error: "Ask Nova a question or attach a file." }, { status: 400 });
  if (file && file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is larger than Nova’s 40 MB limit." }, { status: 413 });
  }

  let history: { role: "user" | "assistant"; content: string }[] = [];
  try {
    const parsed = JSON.parse(String(form.get("history") ?? "[]")) as unknown;
    if (Array.isArray(parsed)) {
      history = parsed.slice(-8).flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const value = entry as { role?: unknown; content?: unknown };
        if ((value.role !== "user" && value.role !== "assistant") || typeof value.content !== "string") return [];
        return [{ role: value.role, content: value.content.replace(/\0/g, "").slice(0, 8_000) }];
      });
    }
  } catch {
    return Response.json({ error: "Nova’s conversation history was invalid." }, { status: 400 });
  }

  const created = await createNovaJob({
    authorId: profile.id,
    question: question || "Read the attached file and complete the requested work.",
    history,
    scopeCustomerId: String(form.get("scopeCustomerId") ?? "").trim() || undefined,
    file,
  });
  return Response.json({ jobId: created.id }, { status: 202 });
}
