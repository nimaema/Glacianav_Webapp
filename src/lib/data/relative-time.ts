// Formats a Date as the short relative strings the UI already uses
// throughout (fixtures.ts hand-wrote these: "12 min ago", "3 d ago", "2 w
// ago") — one real implementation now that timestamps are real Dates
// instead of fixture prose.

export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} d ago`;
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) return `${diffWeek} w ago`;
  const diffMonth = Math.round(diffDay / 30);
  return `${diffMonth} mo ago`;
}
