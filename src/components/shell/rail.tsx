"use client";

import { useState } from "react";
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
  Compass,
  DotsThree,
  X,
  type Icon,
} from "@phosphor-icons/react";

type NavItem = { href: string; label: string; icon: Icon };

const PRIMARY: NavItem[] = [
  { href: "/", label: "Briefing", icon: House },
  { href: "/validation-progress", label: "Validation", icon: Kanban },
  { href: "/customers", label: "Customers", icon: Buildings },
  { href: "/contacts", label: "Contacts", icon: IdentificationCard },
  { href: "/library", label: "Library", icon: Books },
  { href: "/work", label: "Work", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/insights", label: "Insights", icon: ChartBar },
  { href: "/ask", label: "Ask", icon: Sparkle },
];

const SYSTEM: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Gear },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

const MOBILE_PRIMARY = PRIMARY.filter((item) => ["/", "/customers", "/work", "/library"].includes(item.href));
const MOBILE_MORE = [...PRIMARY, ...SYSTEM].filter((item) => !MOBILE_PRIMARY.some((primary) => primary.href === item.href));

function Brand() {
  return (
    <Link href="/" aria-label="GlaciaNav home" className="flex h-full min-w-[172px] items-center gap-3 border-r border-line px-4 lg:min-w-[210px] lg:px-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center bg-ink text-signal">
        <Compass size={20} weight="fill" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[19px] font-semibold leading-none tracking-[-0.03em] text-ink">GlaciaNav</span>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3">Command desk</span>
      </span>
    </Link>
  );
}

function DeskLink({ item, active }: { item: NavItem; active: boolean }) {
  const IconEl = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={`relative flex h-full min-w-12 shrink-0 items-center justify-center gap-2 border-r border-line/70 px-3 text-[12px] font-semibold transition-colors lg:min-w-14 xl:px-4 ${
        active ? "bg-ink text-deep-ink after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-signal" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <IconEl size={17} weight={active ? "fill" : "regular"} />
      <span className="hidden xl:inline">{item.label}</span>
    </Link>
  );
}

export function Rail() {
  const pathname = usePathname();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <nav aria-label="Primary" className="hidden h-[68px] shrink-0 border-b border-ink bg-surface md:flex">
        <Brand />
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {PRIMARY.map((item) => <DeskLink key={item.href} item={item} active={isActive(item.href)} />)}
        </div>
        <div className="ml-auto flex shrink-0 border-l border-line">
          {SYSTEM.map((item) => <DeskLink key={item.href} item={item} active={isActive(item.href)} />)}
        </div>
      </nav>

      <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-surface px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY.map((item) => {
            const IconEl = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "bg-ink text-deep-ink before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-signal" : "text-ink-2"}`}>
                <IconEl size={19} weight={active ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMobileMoreOpen(true)} aria-expanded={mobileMoreOpen} className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-ink-2"><DotsThree size={20} /><span>More</span></button>
        </div>
      </nav>

      {mobileMoreOpen && (
        <div className="anim-overlay-in fixed inset-0 z-50 flex items-end bg-ink/40 md:hidden" onPointerDown={() => setMobileMoreOpen(false)}>
          <div className="anim-drawer-in max-h-[82dvh] w-full overflow-y-auto border-t-2 border-ink bg-surface p-4" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex h-12 items-center justify-between border-b border-line pb-3">
              <span className="font-display text-[24px] font-semibold text-ink">All desks</span>
              <button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Close navigation" className="grid h-11 w-11 place-items-center border border-ink text-ink"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 border-l border-t border-line">
              {MOBILE_MORE.map((item) => {
                const IconEl = item.icon;
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMoreOpen(false)} className={`flex min-h-16 items-center gap-3 border-b border-r border-line px-3 text-[13px] font-semibold ${active ? "bg-ink text-deep-ink" : "text-ink-2"}`}>
                    <IconEl size={19} />{item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
