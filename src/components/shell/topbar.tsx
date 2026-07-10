"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MagnifyingGlass,
  Plus,
  Bell,
  Microphone,
  UploadSimple,
  UserPlus,
  NotePencil,
  Gear,
  SignOut,
  Compass,
  type Icon,
} from "@phosphor-icons/react";
import { OPEN_PALETTE_EVENT } from "./command-palette";
import { useOutsideClick } from "@/lib/use-outside-click";
import type { Profile } from "@/lib/auth/ensure-profile";
import type { NotificationItem } from "@/lib/data/notifications";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/data/notifications-actions";
import { signOut } from "@/lib/auth/actions";

const NEW_ITEMS: { icon: Icon; label: string; hint?: string; href?: string }[] = [
  { icon: Microphone, label: "Record a conversation", hint: "⌘R", href: "/record" },
  { icon: UploadSimple, label: "Upload audio" },
  { icon: UserPlus, label: "New customer", href: "/customers/new" },
  { icon: NotePencil, label: "New note", href: "/library?new=note" },
];

export function TopBar({
  profile,
  notifications,
  unreadCount,
}: {
  profile: Profile | null;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  // The page itself carries its own title now. Repeating it
  // here would create two stacked headers saying the same word. The bar
  // stays pure utility: global search, quick-create, notifications, avatar.
  const [newOpen, setNewOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

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

  useOutsideClick(notifRef, () => setNotifOpen(false), notifOpen);
  useOutsideClick(avatarRef, () => setAvatarOpen(false), avatarOpen);

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-2 border-b border-line-2 bg-white px-3 text-ink sm:gap-4 sm:px-5 lg:px-8">
      <Link href="/" aria-label="GlaciaNav home" className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-melt text-white md:hidden">
        <Compass size={21} weight="fill" />
      </Link>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
        aria-label="Search workspace"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] border border-line-2 bg-surface-2 px-3 text-[14px] text-ink-2 hover:border-line hover:bg-white hover:text-ink sm:w-72 sm:justify-between sm:px-4"
      >
        <span className="flex items-center gap-2">
          <MagnifyingGlass size={15} />
          <span className="hidden sm:inline">Search workspace</span>
        </span>
        <kbd className="hidden rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] text-ink-3 sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setNewOpen((v) => !v)}
            aria-expanded={newOpen}
            aria-haspopup="menu"
            className="flex h-11 cursor-pointer items-center gap-2 rounded-[13px] bg-melt px-3.5 text-[14px] font-semibold text-white shadow-[0_7px_16px_rgba(39,94,231,.18)] hover:bg-melt-strong sm:px-4"
          >
            <Plus size={16} weight="bold" />
            <span className="hidden sm:inline">New</span>
          </button>
          {newOpen && (
            <div
              role="menu"
              className="surfaced-lg absolute right-0 top-12 z-30 w-64 p-1.5"
            >
              {NEW_ITEMS.map(({ icon: IconEl, label, hint, href }) => {
                const className =
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[14px] text-ink hover:bg-surface-2";
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

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-expanded={notifOpen}
            aria-haspopup="menu"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] border border-line-2 bg-white text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-data-coral"
              />
            )}
          </button>
          {notifOpen && (
            <div role="menu" className="surfaced-lg absolute right-0 top-12 z-30 w-80 p-1.5">
              <div className="flex items-center justify-between gap-3 px-2.5 py-2">
                <span className="text-[14px] font-semibold text-ink">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead(profile?.id ?? "")}
                    className="cursor-pointer text-[12px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="flex max-h-96 flex-col overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-2.5 py-4 text-center text-[13.5px] text-ink-2">
                    No notifications yet.
                  </p>
                )}
                {notifications.map((n) => {
                  const content = (
                    <>
                      <span className="flex items-center gap-1.5">
                        {!n.read && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-melt" />}
                        <span className={`min-w-0 flex-1 text-[13.5px] ${n.read ? "text-ink-2" : "font-semibold text-ink"}`}>
                          {n.title}
                        </span>
                      </span>
                      {n.body && <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{n.body}</span>}
                      <span className="mt-1 block font-mono text-[11px] text-ink-3 tabular-nums">{n.when}</span>
                    </>
                  );
                  const rowClass = "flex w-full cursor-pointer flex-col rounded-[10px] px-3 py-2.5 text-left hover:bg-surface-2";
                  return n.href ? (
                    <Link
                      key={n.id}
                      href={n.href}
                      role="menuitem"
                      onClick={() => {
                        setNotifOpen(false);
                        if (!n.read) void markNotificationRead(n.id);
                      }}
                      className={rowClass}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={n.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (!n.read) void markNotificationRead(n.id);
                      }}
                      className={rowClass}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={avatarRef}>
          <button
            type="button"
            onClick={() => setAvatarOpen((v) => !v)}
            aria-expanded={avatarOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white hover:bg-ink-2"
          >
            {profile?.initials ?? "?"}
          </button>
          {avatarOpen && (
            <div role="menu" className="surfaced-lg absolute right-0 top-12 z-30 w-56 p-1.5">
              <div className="border-b border-line-2 px-2.5 pb-2 pt-1">
                <p className="truncate text-[14px] font-semibold text-ink">{profile?.name ?? "Not signed in"}</p>
                <p className="truncate text-[12.5px] text-ink-2">{profile?.email}</p>
              </div>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setAvatarOpen(false)}
                className="mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
              >
                <Gear size={16} className="text-ink-3" />
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut()}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-semibold text-danger transition-colors duration-150 hover:bg-danger/10"
              >
                <SignOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
