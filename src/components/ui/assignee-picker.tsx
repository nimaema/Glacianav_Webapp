"use client";

import { useRef, useState } from "react";
import { Check, UserPlus } from "@phosphor-icons/react";
import { useOutsideClick } from "@/lib/use-outside-click";
import { ownerById, type Owner } from "@/lib/fixtures";
import { Avatar } from "./avatar";

/** Multi-select assignee stack: click to open, toggle members, click away to
 * close. `owners` is the real team (passed from the page's DB query) — never
 * the fixtures placeholder set, so you assign to actual users. */
export function AssigneePicker({
  assigneeIds,
  onToggle,
  owners,
}: {
  assigneeIds: string[];
  onToggle: (ownerId: string) => void;
  owners: Owner[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const active = owners.filter((o) => o.active !== false);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Change assignees"
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full transition-opacity duration-150 hover:opacity-80"
      >
        {assigneeIds.length > 0 ? (
          <span className="flex -space-x-1.5">
            {assigneeIds.map((id) => (
              <span key={id} className="rounded-full ring-2 ring-white">
                <Avatar owner={ownerById(id, owners)} size={26} />
              </span>
            ))}
          </span>
        ) : (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-dashed border-ink-3 text-ink-3">
              <UserPlus size={13} />
            </span>
            <span className="text-[13px] font-semibold text-ink-2">Assign</span>
          </>
        )}
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute right-0 top-8 z-30 w-52 p-1.5">
          {active.map((o) => {
            const checked = assigneeIds.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={() => onToggle(o.id)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
              >
                <Avatar owner={o} size={22} />
                {o.name}
                {checked && <Check size={14} weight="bold" className="ml-auto text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
