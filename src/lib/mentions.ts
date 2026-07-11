// Plain, dependency-free @mention parsing — used both server-side (resolve
// who to notify) and client-side (render mention chips in posted comments),
// so this file must stay safe to import from either.

export type MentionCandidate = { id: string; name: string };
export const NOVA_MENTION_NAME = "Nova";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest-name-first so a shorter name that's a prefix of a longer one
// (unlikely with this team's single first names, but cheap to guard)
// never steals a match from the full name.
function mentionRegex(names: string[]): RegExp {
  const escaped = names
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return new RegExp(`@(${escaped.join("|")})\\b`, "g");
}

export function parseMentions(
  body: string,
  owners: MentionCandidate[],
): { mentionedOwnerIds: string[]; mentionsNova: boolean } {
  const names = [...owners.map((o) => o.name), NOVA_MENTION_NAME];
  const regex = mentionRegex(names);
  const mentionedOwnerIds = new Set<string>();
  let mentionsNova = false;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body))) {
    if (match[1] === NOVA_MENTION_NAME) {
      mentionsNova = true;
      continue;
    }
    const owner = owners.find((o) => o.name === match![1]);
    if (owner) mentionedOwnerIds.add(owner.id);
  }
  return { mentionedOwnerIds: [...mentionedOwnerIds], mentionsNova };
}

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; isNova: boolean };

// Splits a comment body into plain-text and mention segments so the UI can
// render "@Name" as a styled chip instead of plain characters.
export function splitMentions(body: string, owners: MentionCandidate[]): MentionSegment[] {
  const names = [...owners.map((o) => o.name), NOVA_MENTION_NAME];
  if (names.length === 0) return [{ type: "text", value: body }];
  const regex = mentionRegex(names);
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body))) {
    if (match.index > lastIndex) segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
    segments.push({ type: "mention", name: match[1], isNova: match[1] === NOVA_MENTION_NAME });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ type: "text", value: body.slice(lastIndex) });
  return segments;
}
