"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Buildings,
  Kanban,
  IdentificationCard,
  Books,
  ListChecks,
  CalendarBlank,
  ChartBar,
  Sparkle,
  Gear,
  ShieldCheck,
  SignOut,
  type Icon,
} from "@phosphor-icons/react";
import { useOutsideClick } from "@/lib/use-outside-click";
import type { Profile } from "@/lib/auth/ensure-profile";
import { signOut } from "@/lib/auth/actions";

type NavItem = { href: string; label: string; icon: Icon };
type Section = { label: string | null; items: NavItem[] };

const SECTIONS: Section[] = [
  { label: null, items: [{ href: "/", label: "Home", icon: House }] },
  {
    label: "Records",
    items: [
      { href: "/validation-progress", label: "Validation Progress", icon: Kanban },
      { href: "/customers", label: "Customers", icon: Buildings },
      { href: "/contacts", label: "Contacts", icon: IdentificationCard },
      { href: "/library", label: "Library", icon: Books },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/work", label: "Work", icon: ListChecks },
      { href: "/calendar", label: "Calendar", icon: CalendarBlank },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/insights", label: "Insights", icon: ChartBar },
      { href: "/ask", label: "Ask", icon: Sparkle },
    ],
  },
];

const FOOT: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Gear },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const IconEl = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative mx-3 flex min-h-11 items-center gap-3 border-l-2 px-3 text-[14px] transition-colors duration-150 ${
        active
          ? "border-signal bg-white/[0.07] font-semibold text-white"
          : "border-transparent text-deep-ink-2 hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute right-3 h-1.5 w-1.5 bg-signal"
        />
      )}
      <IconEl size={18} className={active ? "text-signal" : "text-deep-ink-2"} />
      <span className="min-w-0 flex-1 truncate" title={item.label}>
        {item.label}
      </span>
    </Link>
  );
}

export function Rail({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menuRef, () => setMenuOpen(false), menuOpen);

  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-[248px] shrink-0 flex-col bg-deep text-deep-ink md:flex"
    >
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/10 px-6">
        <span className="grid h-8 w-8 place-items-center bg-signal font-mono text-[13px] font-bold text-deep">GN</span>
        <div><p className="text-[15px] font-semibold tracking-[-0.01em]">GlaciaNav</p><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deep-ink-2">Field workspace</p></div>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
        {SECTIONS.map((section) => (
          <div key={section.label ?? "top"} className="flex flex-col gap-px">
            {section.label && (
              <div className="px-6 pb-1 pt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-deep-ink-2">
                {section.label}
              </div>
            )}
            {section.items.map((item) => (
              <RailLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/10 py-3">
        {FOOT.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <div ref={menuRef} className="relative mx-3 mt-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.05]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-signal">
              {profile?.initials ?? "?"}
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-semibold leading-tight text-white">
              <span className="block truncate">{profile?.name ?? "Not signed in"}</span>
              <span className="block font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-deep-ink-2">
                {profile?.role ?? "—"}
              </span>
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="surfaced-lg absolute bottom-full left-3 right-3 z-30 mb-2 p-1.5"
            >
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
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
    </nav>
  );
}
