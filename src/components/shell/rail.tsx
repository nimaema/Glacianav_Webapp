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
  Compass,
  DotsThree,
  X,
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
    label: "Relationships",
    items: [
      { href: "/validation-progress", label: "Validation progress", icon: Kanban },
      { href: "/customers", label: "Customers", icon: Buildings },
      { href: "/contacts", label: "Contacts", icon: IdentificationCard },
      { href: "/library", label: "Library", icon: Books },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/work", label: "Work", icon: ListChecks },
      { href: "/calendar", label: "Calendar", icon: CalendarBlank },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/insights", label: "Insights", icon: ChartBar },
      { href: "/ask", label: "Ask Nova", icon: Sparkle },
    ],
  },
];

const FOOT: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Gear },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

const ALL_ITEMS = [...SECTIONS.flatMap((section) => section.items), ...FOOT];
const MOBILE_PRIMARY = ALL_ITEMS.filter((item) => ["/", "/customers", "/work", "/library"].includes(item.href));
const MOBILE_MORE = ALL_ITEMS.filter((item) => !MOBILE_PRIMARY.some((primary) => primary.href === item.href));

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="GlaciaNav home">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-melt text-white shadow-[0_8px_20px_rgba(39,94,231,.22)]">
        <Compass size={22} weight="fill" />
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold tracking-[-0.03em] text-ink">GlaciaNav</span>
        <span className="block font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-ink-3">Workspace</span>
      </span>
    </Link>
  );
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const IconEl = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`group relative mx-3 flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-[14px] transition-colors duration-150 ${
        active
          ? "atlas-route bg-melt/10 pl-5 font-semibold text-melt"
          : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <IconEl size={19} weight={active ? "fill" : "regular"} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={item.label}>{item.label}</span>
    </Link>
  );
}

export function Rail({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menuRef, () => setMenuOpen(false), menuOpen);

  return (
    <>
      <nav aria-label="Primary" className="hidden h-dvh w-[260px] shrink-0 flex-col border-r border-line-2 bg-white md:flex">
        <div className="flex h-[72px] shrink-0 items-center border-b border-line-2 px-5"><Brand /></div>
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-3">
          {SECTIONS.map((section) => (
            <div key={section.label ?? "top"} className="flex flex-col gap-0.5">
              {section.label && <div className="px-6 pb-1 pt-3.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">{section.label}</div>}
              {section.items.map((item) => <RailLink key={item.href} item={item} active={isActive(item.href)} />)}
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-line-2 py-3">
          {FOOT.map((item) => <RailLink key={item.href} item={item} active={isActive(item.href)} />)}
          <div ref={menuRef} className="relative mx-3 mt-3 border-t border-line-2 pt-3">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 text-left hover:bg-surface-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">{profile?.initials ?? "?"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{profile?.name ?? "Not signed in"}</span>
                <span className="block truncate text-[11px] text-ink-3">{profile?.role ?? "No role"}</span>
              </span>
              <DotsThree size={18} className="text-ink-3" />
            </button>
            {menuOpen && (
              <div role="menu" className="surfaced-lg absolute bottom-full left-0 right-0 z-30 mb-2 p-1.5">
                <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] text-ink hover:bg-surface-2"><Gear size={17} className="text-ink-3" />Settings</Link>
                <button type="button" role="menuitem" onClick={() => signOut()} className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-semibold text-danger hover:bg-danger/10"><SignOut size={17} />Sign out</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-2 bg-white/95 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {MOBILE_PRIMARY.map((item) => {
            const IconEl = item.icon;
            const active = isActive(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[10px] text-[10px] font-medium ${active ? "bg-melt/10 text-melt" : "text-ink-3"}`}><IconEl size={20} weight={active ? "fill" : "regular"} /><span>{item.label}</span></Link>;
          })}
          <button type="button" onClick={() => setMobileMoreOpen(true)} aria-expanded={mobileMoreOpen} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-[10px] text-[10px] font-medium text-ink-3"><DotsThree size={20} /><span>More</span></button>
        </div>
      </nav>

      {mobileMoreOpen && (
        <div className="anim-overlay-in fixed inset-0 z-50 flex items-end bg-ink/30 p-3 md:hidden" onPointerDown={() => setMobileMoreOpen(false)}>
          <div className="anim-drawer-in surfaced-lg max-h-[78dvh] w-full overflow-y-auto p-3" onPointerDown={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2 py-1"><Brand /><button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Close navigation" className="grid h-11 w-11 place-items-center rounded-[12px] text-ink-2 hover:bg-surface-2"><X size={20} /></button></div>
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_MORE.map((item) => { const IconEl = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileMoreOpen(false)} className={`flex min-h-14 items-center gap-3 rounded-[12px] px-3 text-[13px] font-medium ${isActive(item.href) ? "bg-melt/10 text-melt" : "bg-surface-2 text-ink-2"}`}><IconEl size={19} />{item.label}</Link>; })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
