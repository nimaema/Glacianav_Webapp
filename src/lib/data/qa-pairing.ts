// Every qaMessages thread is stored as a flat, chronologically-ordered
// log: a question insert, then (after a real LLM round trip that now
// takes real seconds) its answer insert. If a second question lands in
// that gap — same scope, another tab, someone typing fast — its answer
// commits later still, so strict created_at order can print an answer
// several questions after the one it belongs to. Re-pair on read: send
// every answer to the oldest still-unanswered question, not wherever
// its timestamp happened to fall.

export function pairQaHistory<T extends { role: "user" | "assistant" }>(rows: T[]): T[] {
  const result: T[] = [];
  const pendingUserIdx: number[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      result.push(row);
      pendingUserIdx.push(result.length - 1);
      continue;
    }
    const idx = pendingUserIdx.shift();
    if (idx === undefined) {
      result.push(row); // orphan answer with no open question — keep it, just don't reorder
      continue;
    }
    result.splice(idx + 1, 0, row);
    for (let i = 0; i < pendingUserIdx.length; i++) pendingUserIdx[i]++;
  }
  return result;
}
