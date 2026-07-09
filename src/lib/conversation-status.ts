import type { PillTone } from "@/components/ui/pill";
import type { Conversation } from "./fixtures";

export function statusChips(
  c: Conversation,
): { label: string; tone: PillTone }[] {
  if (c.status === "processing") return [{ label: "Processing", tone: "gray" }];
  if (c.status === "ready") {
    const chips: { label: string; tone: PillTone }[] = [
      { label: "Summary ready", tone: "green" },
    ];
    if (c.actionCount > 0)
      chips.push({
        label: `${c.actionCount} action item${c.actionCount === 1 ? "" : "s"}`,
        tone: "violet",
      });
    return chips;
  }
  return [{ label: "Reviewed", tone: "gray" }];
}
