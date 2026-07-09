"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Plus, X } from "@phosphor-icons/react";
import { useOutsideClick } from "@/lib/use-outside-click";

export type LinkOption = { id: string; label: string; sub?: string; href?: string };

function LinkBucket({
  icon,
  label,
  linked,
  options,
  onAdd,
  onRemove,
  emptyLabel,
}: {
  icon: React.ReactNode;
  label: string;
  linked: LinkOption[];
  options: LinkOption[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const available = options.filter((o) => !linked.some((l) => l.id === o.id));

  return (
    <div className="recessed flex min-w-0 flex-col gap-2.5 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/70 text-melt ring-1 ring-line-2">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.11em] text-ink-3">
            {label}
          </p>
          <p className="font-mono text-[11.5px] font-semibold text-ink-3 tabular-nums">
            {linked.length} linked
          </p>
        </div>
        {available.length > 0 && (
          <div className="relative ml-auto" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              className="flex h-7 cursor-pointer items-center gap-1 rounded-md bg-white/80 px-2.5 text-[12.5px] font-bold text-melt ring-1 ring-melt/25 transition-colors duration-150 hover:bg-melt/10"
            >
              <Plus size={12} weight="bold" />
              Add
            </button>
            {open && (
              <div
                role="menu"
                className="surfaced-lg absolute right-0 top-9 z-30 max-h-64 w-64 overflow-y-auto p-1.5"
              >
                {available.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAdd(o.id);
                      setOpen(false);
                    }}
                    className="flex w-full cursor-pointer flex-col rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                  >
                    <span className="text-[13.5px] font-semibold text-ink">{o.label}</span>
                    {o.sub && <span className="text-[12.5px] text-ink-3">{o.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {linked.map((l) => {
          const inner = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">
                  {l.label}
                </span>
                {l.sub && <span className="block truncate text-[12.5px] text-ink-3">{l.sub}</span>}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove(l.id);
                }}
                aria-label={`Unlink ${l.label}`}
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              >
                <X size={12} weight="bold" />
              </button>
            </>
          );
          const className =
            "flex min-h-10 items-center gap-2 rounded-md bg-white/65 px-2.5 py-2 text-left ring-1 ring-line-2 transition-colors duration-150 hover:bg-white";
          return l.href ? (
            <Link key={l.id} href={l.href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={l.id} className={className}>
              {inner}
            </div>
          );
        })}
        {linked.length === 0 && (
          <p className="rounded-md border border-dashed border-line px-3 py-2 text-[13px] text-ink-3">
            {emptyLabel}
          </p>
        )}
      </div>
    </div>
  );
}

export function RelationshipLinkPanel({
  customers,
  contacts,
}: {
  customers: {
    linked: LinkOption[];
    options: LinkOption[];
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
  };
  contacts: {
    linked: LinkOption[];
    options: LinkOption[];
    onAdd: (id: string) => void;
    onRemove: (id: string) => void;
  };
}) {
  return (
    <section data-rise className="surfaced px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">
            Linked records
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Attach the accounts and people this item should appear under.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <LinkBucket
          icon={customers.linked.length > 0 ? customers.linked.length : <Plus size={13} weight="bold" />}
          label="Customers"
          linked={customers.linked}
          options={customers.options}
          onAdd={customers.onAdd}
          onRemove={customers.onRemove}
          emptyLabel="No customers linked"
        />
        <LinkBucket
          icon={contacts.linked.length > 0 ? contacts.linked.length : <Plus size={13} weight="bold" />}
          label="Contacts"
          linked={contacts.linked}
          options={contacts.options}
          onAdd={contacts.onAdd}
          onRemove={contacts.onRemove}
          emptyLabel="No contacts linked"
        />
      </div>
    </section>
  );
}

/** A labeled, editable set of linked records — customers or contacts on a
 * conversation. Each linked chip removes on click of its own ×; an "Add"
 * ghost chip opens a picker of everything not yet linked. */
export function LinkedSection({
  icon,
  label,
  linked,
  options,
  onAdd,
  onRemove,
  emptyLabel,
}: {
  icon: React.ReactNode;
  label: string;
  linked: LinkOption[];
  options: LinkOption[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const available = options.filter((o) => !linked.some((l) => l.id === o.id));

  const Chip = ({ l }: { l: LinkOption }) => {
    const inner = (
      <>
        {l.label}
        {l.sub && <span className="text-ink-3">· {l.sub}</span>}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(l.id);
          }}
          aria-label={`Unlink ${l.label}`}
          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-[rgba(11,61,77,0.15)] hover:text-ink"
        >
          <X size={10} weight="bold" />
        </button>
      </>
    );
    const className =
      "flex items-center gap-1.5 rounded-full bg-[rgba(11,61,77,0.06)] py-1 pl-3 pr-1.5 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-melt/10 hover:text-melt";
    return l.href ? (
      <Link href={l.href} className={className}>
        {inner}
      </Link>
    ) : (
      <span className={className}>{inner}</span>
    );
  };

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">
        {icon}
        {label}
        {linked.length > 0 && (
          <span className="font-mono text-[11px] tabular-nums">{linked.length}</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {linked.map((l) => (
          <Chip key={l.id} l={l} />
        ))}
        {available.length > 0 && (
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12.5px] font-bold text-ink-3 transition-colors duration-150 hover:border-melt/60 hover:text-melt"
            >
              <Plus size={12} weight="bold" />
              Add
            </button>
            {open && (
              <div
                role="menu"
                className="surfaced-lg absolute left-0 top-8 z-30 max-h-64 w-56 overflow-y-auto p-1.5"
              >
                {available.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAdd(o.id);
                      setOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
                  >
                    {o.label}
                    {o.sub && <span className="text-[12px] text-ink-3">{o.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {linked.length === 0 && available.length === 0 && (
          <span className="text-[13px] text-ink-3">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}
