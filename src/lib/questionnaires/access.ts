import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getCurrentProfile } from "@/lib/data/current-user";
import { localMode, qdb, type QDatabase } from "./database";
import type { Questionnaire } from "./types";
import { questionnairePermissions } from "./permissions";
export class QuestionnaireError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const viewer = cache(async () => {
  if (localMode()) {
    const h = await headers();
    const host = h.get("host")?.split(":")[0];
    if (!["localhost", "127.0.0.1"].includes(host ?? ""))
      throw new QuestionnaireError(
        "Local preview is available only on this machine.",
        403,
      );
    return {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Local preview",
      initials: "LP",
      color: "#3d6fa6",
      email: "preview@example.test",
      role: "admin" as const,
      active: true,
      authUserId: null,
      staleDays: 7,
      followupLeadHours: 24,
      interviewLeadMinutes: 30,
      emailDigest: false,
      createdAt: new Date(0),
    };
  }
  const me = await getCurrentProfile();
  if (!me?.active)
    throw new QuestionnaireError(
      "Sign in with an active workspace account.",
      401,
    );
  return me;
});
export async function access(
  id: string,
  permission: "read" | "edit" | "send" | "manage" = "read",
  database?: QDatabase,
) {
  const me = await viewer();
  const db = database ?? (await qdb());
  const [q] = await db.query<Questionnaire>(
    "SELECT * FROM questionnaires WHERE id=$1",
    [id],
  );
  if (!q) throw new QuestionnaireError("Questionnaire not found.", 404);
  const owner = q.owner_id === me.id || me.role === "admin";
  const [member] = await db.query<{ role: string }>(
    "SELECT role FROM questionnaire_access WHERE questionnaire_id=$1 AND profile_id=$2",
    [id, me.id],
  );
  const permissions = questionnairePermissions(owner, member?.role);
  const granted = {
    read: permissions.canOpen,
    manage: permissions.canManage,
    edit: permissions.canEdit,
    send: permissions.canSend,
  }[permission];
  if (!granted)
    throw new QuestionnaireError(
      "You do not have access to this questionnaire.",
      403,
    );
  return {
    q,
    me,
    db,
    ...permissions,
  };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.SITE_URL
    ? new URL(process.env.SITE_URL).origin
    : new URL(request.url).origin;
  if (
    origin !== expected &&
    !(
      process.env.NODE_ENV === "development" &&
      !!origin &&
      new URL(origin).host === request.headers.get("host") &&
      ["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
    )
  )
    throw new QuestionnaireError("Reload the page before trying again.", 403);
}
export async function jsonBody(
  request: Request,
  limit = 400000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new QuestionnaireError("Request is too large.", 413);
  const text = await request.text();
  if (text.length > limit)
    throw new QuestionnaireError("Request is too large.", 413);
  return JSON.parse(text);
}
export function failure(error: unknown) {
  if (error instanceof QuestionnaireError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json(
      { error: "Check the supplied fields and try again." },
      { status: 400 },
    );
  console.error(
    "Questionnaire request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
