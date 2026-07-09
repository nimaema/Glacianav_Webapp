// Optional customer board row fields, show/hide only — matches the CRM's board
// column list (lib/board-columns.ts there): Stage, Problem, Needs, Channel,
// Current solution, Follow-up, Interview, Priority, Notes, plus its
// always-visible Contact/Lead columns, which map to Name + Owner here.
export type BoardColumnId =
  | "stage"
  | "problem"
  | "tags"
  | "channel"
  | "currentSolution"
  | "followup"
  | "interviewDate"
  | "priority"
  | "compatibility"
  | "nextStep"
  | "notes";

export const BOARD_COLUMNS: { id: BoardColumnId; label: string }[] = [
  { id: "stage", label: "Stage" },
  { id: "problem", label: "Problem" },
  { id: "tags", label: "Needs" },
  { id: "channel", label: "Channel" },
  { id: "currentSolution", label: "Current solution" },
  { id: "followup", label: "Follow-up" },
  { id: "interviewDate", label: "Interview" },
  { id: "priority", label: "Priority" },
  { id: "compatibility", label: "Compatibility" },
  { id: "nextStep", label: "Next step" },
  { id: "notes", label: "Notes" },
];

// A curated subset that fits without turning every row into a wall of
// pills — CRM does the same (7 of 11 visible by default there).
export const DEFAULT_VISIBLE_COLUMNS: BoardColumnId[] = [
  "stage",
  "problem",
  "followup",
  "priority",
  "compatibility",
];

const STORAGE_KEY = "gn-board-columns";

export function loadVisibleColumns(): BoardColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE_COLUMNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as BoardColumnId[];
  } catch {
    // fall through to default
  }
  return DEFAULT_VISIBLE_COLUMNS;
}

export function saveVisibleColumns(cols: BoardColumnId[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
}
