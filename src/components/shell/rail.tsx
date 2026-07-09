"use client";

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
  type Icon,
} from "@phosphor-icons/react";

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
      className={`relative mx-2 flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[15px] transition-colors duration-150 ${
        active
          ? "bg-white/90 font-semibold text-ink"
          : "text-ink-2 hover:bg-white/60 hover:text-ink"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded bg-melt"
        />
      )}
      <IconEl size={18} className={active ? "text-melt" : "text-ink-3"} />
      <span className="min-w-0 flex-1 truncate" title={item.label}>
        {item.label}
      </span>
    </Link>
  );
}

export function Rail() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-[232px] shrink-0 flex-col border-r border-line-2 bg-white/50 md:flex"
    >
      <div className="flex h-13 shrink-0 items-center border-b border-line-2 px-4 text-[15px] font-semibold tracking-[0.01em] text-ink">
        GlaciaNav
      </div>

      <div className="flex flex-1 flex-col gap-px overflow-y-auto pt-2.5">
        {SECTIONS.map((section) => (
          <div key={section.label ?? "top"} className="flex flex-col gap-px">
            {section.label && (
              <div className="px-4.5 pb-1 pt-3.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {section.label}
              </div>
            )}
            {section.items.map((item) => (
              <RailLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-line-2 py-2">
        {FOOT.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <div className="mx-2 mt-1.5 flex items-center gap-2.5 px-2.5 pb-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-melt text-[12px] font-bold text-white">
            N
          </span>
          <span className="text-[14.5px] font-semibold leading-tight text-ink">
            Nima
            <span className="block text-[12px] font-normal text-ink-3">admin</span>
          </span>
        </div>
      </div>
    </nav>
  );
}
