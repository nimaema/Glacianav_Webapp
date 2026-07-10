import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type NovaConfirmationPayload = {
  authorId: string;
  toolName: string;
  args: Record<string, unknown>;
  expiresAt: number;
};

const consumedTokens = new Map<string, number>();

function confirmationSecret(): string {
  const secret =
    process.env.NOVA_CONFIRMATION_SECRET ||
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ||
    process.env.DEEPSEEK_API_KEY;
  if (!secret || secret === "dev") {
    throw new Error("Nova confirmation signing is not configured on this server.");
  }
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", confirmationSecret()).update(payload).digest("base64url");
}

export function createNovaConfirmationToken(
  payload: Omit<NovaConfirmationPayload, "expiresAt">,
): string {
  const encoded = Buffer.from(
    JSON.stringify({ ...payload, expiresAt: Date.now() + 10 * 60_000 }),
    "utf8",
  ).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyNovaConfirmationToken(token: string): NovaConfirmationPayload {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) throw new Error("Invalid confirmation request.");
  const expectedSignature = signature(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid confirmation signature.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as NovaConfirmationPayload;
  if (!payload.authorId || !payload.toolName || !payload.args || payload.expiresAt < Date.now()) {
    throw new Error("This confirmation has expired. Ask Nova to prepare the action again.");
  }
  return payload;
}

export function consumeNovaConfirmationToken(token: string): NovaConfirmationPayload {
  const now = Date.now();
  for (const [usedToken, expiresAt] of consumedTokens) {
    if (expiresAt < now) consumedTokens.delete(usedToken);
  }
  if (consumedTokens.has(token)) throw new Error("This action was already confirmed.");
  const payload = verifyNovaConfirmationToken(token);
  consumedTokens.set(token, payload.expiresAt);
  return payload;
}
