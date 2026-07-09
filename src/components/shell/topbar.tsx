"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MagnifyingGlass,
  Plus,
  Bell,
  Microphone,
  UploadSimple,
  UserPlus,
  NotePencil,
  type Icon,
} from "@phosphor-icons/react";
import { OPEN_PALETTE_EVENT } from "./command-palette";

const TITLES: [string, string][] = [
  ["/validation-progress", "Validation Progress"],
  ["/customers", "Customers"],
  ["/contacts", "Contacts"],
  ["/library", "Library"],
  ["/work", "Work"],
  ["/calendar", "Calendar"],
  ["/insights", "Insights"],
  ["/ask", "Ask"],
  ["/settings", "Settings"],
  ["/admin", "Admin"],
  ["/record", "Record"],
];

const NEW_ITEMS: { icon: Icon; label: string; hint?: string; href?: string }[] = [
  { icon: Microphone, label: "Record a conversation", hint: "⌘R", href: "/record" },
  { icon: UploadSimple, label: "Upload audio" },
  { icon: UserPlus, label: "New customer", href: "/customers/new" },
  { icon: NotePencil, label: "New note", href: "/library?new=note" },
];

export function TopBar() {
  const pathname = usePathname();
  const title =
    TITLES.find(([href]) => pathname.startsWith(href))?.[1] ?? "Home";

  const [newOpen, setNewOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setNewOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [newOpen]);

  return (
    <header className="flex h-13 shrink-0 items-center gap-4 border-b border-line-2 bg-white/60 px-5">
      <h1 className="text-[15px] font-semibold text-ink">{title}</h1>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
        className="flex h-9 w-70 max-w-[40vw] cursor-pointer items-center justify-between rounded-md bg-white/90 px-3 text-[14.5px] text-ink-3 shadow-[0_1px_2px_rgba(6,80,96,0.08)] transition-colors duration-150 hover:text-ink-2"
      >
        <span className="flex items-center gap-2">
          <MagnifyingGlass size={15} />
          Search
        </span>
        <kbd className="rounded border border-line px-1 font-mono text-[11.5px] text-ink-3">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setNewOpen((v) => !v)}
            aria-expanded={newOpen}
            aria-haspopup="menu"
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-white/90 px-3 text-[14.5px] font-semibold text-ink-2 shadow-[0_1px_2px_rgba(6,80,96,0.08)] transition-colors duration-150 hover:text-ink"
          >
            <Plus size={15} className="text-melt" weight="bold" />
            New
          </button>
          {newOpen && (
            <div
              role="menu"
              className="surfaced-lg absolute right-0 top-10 z-30 w-64 p-1.5"
            >
              {NEW_ITEMS.map(({ icon: IconEl, label, hint, href }) => {
                const className =
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14.5px] text-ink transition-colors duration-150 hover:bg-surface-2";
                const body = (
                  <>
                    <IconEl size={17} className="text-melt" />
                    {label}
                    {hint && (
                      <kbd className="ml-auto font-mono text-[11.5px] text-ink-3">
                        {hint}
                      </kbd>
                    )}
                  </>
                );
                return href ? (
                  <Link
                    key={label}
                    href={href}
                    role="menuitem"
                    onClick={() => setNewOpen(false)}
                    className={className}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    key={label}
                    type="button"
                    role="menuitem"
                    onClick={() => setNewOpen(false)}
                    className={className}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Notifications, 1 unread"
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-white/90 text-ink-2 shadow-[0_1px_2px_rgba(6,80,96,0.08)] transition-colors duration-150 hover:text-ink"
        >
          <Bell size={17} />
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-data-coral"
          />
        </button>

        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-melt text-[13px] font-bold text-white">
          N
        </span>
      </div>
    </header>
  );
}
