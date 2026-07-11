"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Books,
  Buildings,
  CalendarBlank,
  ChartBar,
  Gear,
  House,
  IdentificationCard,
  Kanban,
  ListChecks,
  MagnifyingGlass,
  Microphone,
  NotePencil,
  Sparkle,
  UploadSimple,
  UserPlus,
  type Icon,
} from "@phosphor-icons/react";
import { segmentById, type Contact, type Customer } from "@/lib/fixtures";

export const OPEN_PALETTE_EVENT = "gn:open-palette";

type Item = {
  id: string;
  group: "Go to" | "Customers" | "Contacts" | "Create";
  label: string;
  sub?: string;
  icon: Icon;
  hint?: string;
  href?: string;
};

const DESTINATIONS: Item[] = [
  { id: "go-home", group: "Go to", label: "Home", icon: House, href: "/" },
  { id: "go-customers", group: "Go to", label: "Customers", icon: Buildings, href: "/customers" },
  { id: "go-validation-progress", group: "Go to", label: "Validation Progress", icon: Kanban, href: "/validation-progress" },
  { id: "go-contacts", group: "Go to", label: "Contacts", icon: IdentificationCard, href: "/contacts" },
  { id: "go-library", group: "Go to", label: "Library", icon: Books, href: "/library" },
  { id: "go-work", group: "Go to", label: "Work", icon: ListChecks, href: "/work" },
  { id: "go-calendar", group: "Go to", label: "Calendar", icon: CalendarBlank, href: "/calendar" },
  { id: "go-insights", group: "Go to", label: "Insights", icon: ChartBar, href: "/insights" },
  { id: "go-ask", group: "Go to", label: "Ask", icon: Sparkle, href: "/ask" },
  { id: "go-settings", group: "Go to", label: "Settings", icon: Gear, href: "/settings" },
];

// Create actions mirror the + New menu; "Upload audio" deep-links to
// /record with ?mode=upload so it lands directly on the Upload tab.
const ACTIONS: Item[] = [
  { id: "act-record", group: "Create", label: "Record a conversation", icon: Microphone, href: "/record" },
  { id: "act-upload", group: "Create", label: "Upload audio", icon: UploadSimple, href: "/record?mode=upload" },
  { id: "act-customer", group: "Create", label: "New customer", icon: UserPlus, href: "/customers/new" },
  { id: "act-note", group: "Create", label: "New note", icon: NotePencil, href: "/library?new=note" },
];

export function CommandPalette({ customers, contacts }: { customers: Customer[]; contacts: Contact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => {
    const customerById = new Map(customers.map((c) => [c.id, c]));
    const customerItems: Item[] = customers.map((c) => ({
      id: `customer-${c.id}`,
      group: "Customers",
      label: c.name,
      sub: segmentById(c.segmentId).name,
      icon: Buildings,
      href: `/customers?c=${c.id}`,
    }));
    const contactItems: Item[] = contacts.map((p) => {
      const account = p.customerId ? customerById.get(p.customerId) : undefined;
      return {
        id: `contact-${p.id}`,
        group: "Contacts",
        label: p.name,
        sub: account?.name,
        icon: IdentificationCard,
        href: account ? `/customers/${account.id}` : "/contacts",
      };
    });
    return [...DESTINATIONS, ...ACTIONS, ...customerItems, ...contactItems];
  }, [customers, contacts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setActive(0);
      }
    };
    const onOpenEvent = () => {
      setOpen(true);
      setQuery("");
      setActive(0);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) || i.sub?.toLowerCase().includes(q),
    );
  }, [query, allItems]);

  // Pre-existing crash, found while browser-verifying real search data:
  // a query with zero matches across every group left `id` undefined, and
  // `#${CSS.escape("")}` is `"#"` alone — not a valid selector, so
  // querySelector threw instead of just finding nothing.
  useEffect(() => {
    const id = results[active]?.id;
    if (!id) return;
    listRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  if (!open) return null;

  const close = () => setOpen(false);
  const run = (item: Item) => {
    close();
    if (item.href) router.push(item.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((v) => Math.min(v + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((v) => Math.max(v - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) run(results[active]);
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  };

  return (
    <div
      className="anim-overlay-in fixed inset-0 z-50 bg-[rgba(23,32,43,0.45)] pt-[16vh]"
      onPointerDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onPointerDown={(e) => e.stopPropagation()}
        className="anim-palette-in surfaced-lg mx-auto flex max-h-[52vh] w-140 max-w-[calc(100vw-32px)] flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2.5 border-b border-line-2 px-4">
          <MagnifyingGlass size={17} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search customers, contacts, pages, actions"
            aria-label="Search customers, contacts, pages, actions"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active]?.id}
            className="h-11 w-full bg-transparent text-[15.5px] text-ink outline-none placeholder:text-ink-3"
          />
          <kbd className="shrink-0 rounded border border-line px-1 font-mono text-[11.5px] text-ink-3">
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="overflow-y-auto p-1.5"
        >
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[14.5px] text-ink-3">
              Nothing matches &ldquo;{query}&rdquo;. Try a customer, a contact, or a page.
            </p>
          )}
          {results.map((item, i) => {
            const IconEl = item.icon;
            const showGroup = i === 0 || results[i - 1].group !== item.group;
            return (
              <div key={item.id}>
                {showGroup && (
                  <div className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                    {item.group}
                  </div>
                )}
                <div
                  id={item.id}
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => setActive(i)}
                  onClick={() => run(item)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14.5px] transition-colors duration-150 ${
                    i === active
                      ? "bg-[var(--accent-soft)] font-semibold text-ink"
                      : "text-ink-2"
                  }`}
                >
                  <IconEl
                    size={17}
                    className={i === active ? "text-accent" : "text-ink-3"}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.sub && (
                    <span className="truncate text-[13px] text-ink-3">
                      {item.sub}
                    </span>
                  )}
                  {item.hint && (
                    <kbd className="ml-auto font-mono text-[11.5px] text-ink-3">
                      {item.hint}
                    </kbd>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
