"use client";

import { Avatar } from "@/components/ui/avatar";
import { ownerById, TONE_HEX, type Customer, type Owner, type Stage } from "@/lib/fixtures";

/**
 * Floating stage filter, CRM-style: one pill per stage with a count and
 * stacked owner avatars. Click filters the Board to that stage; click the
 * active pill again to clear.
 */
export function StageDock({
  rows,
  stages,
  owners,
  activeStage,
  onSelect,
}: {
  rows: Customer[];
  stages: Stage[];
  owners: Owner[];
  activeStage: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <div className="pointer-events-none sticky bottom-5 z-20 mt-6 flex justify-center">
      <div className="surfaced-lg pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto px-2 py-1.5">
        {stages.map((s) => {
          const inStage = rows.filter((c) => c.stage === s.key);
          if (inStage.length === 0) return null;
          const active = activeStage === s.key;
          const ownerIds = [...new Set(inStage.map((c) => c.ownerId))].slice(0, 3);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(active ? null : s.key)}
              aria-pressed={active}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
                active ? "bg-accent text-white" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: active ? "#ffffff" : TONE_HEX[s.tone] }}
              />
              {s.label}
              <span
                className={`font-mono text-[12px] tabular-nums ${active ? "text-white/80" : "text-ink-3"}`}
              >
                {inStage.length}
              </span>
              <span className="flex -space-x-1.5">
                {ownerIds.map((id) => (
                  <span
                    key={id}
                    className={`rounded-full ring-2 ${active ? "ring-accent" : "ring-white"}`}
                  >
                    <Avatar owner={ownerById(id, owners)} size={20} />
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
