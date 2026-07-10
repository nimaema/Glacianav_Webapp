"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Buildings, MagnifyingGlass, Plus, User, X } from "@phosphor-icons/react";
import { useOutsideClick } from "@/lib/use-outside-click";

// "Filed under" — the one linked-records language for the whole app
// (conversation workspace, Record's session rail). A routing ledger, not a
// chip cloud: each lane is a labeled rail with node dots on a hairline
// spine, each record a monogram tile + name row that reads like a chart
// legend entry. Deterministic data-palette monograms give every account and
// person a stable identity color across the app.

export type LinkedRecord = { id: string; label: string; sub?: string; href?: string };

export type LinkedLane = {
  kind: "customers" | "people";
  linked: LinkedRecord[];
  options: LinkedRecord[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

const PALETTE = ["#1F95A8", "#2F9E63", "#6F5FB0", "#D1614A", "#3D6FA6"];

function colorFor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function monogram(label: string) {
  const parts = label.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

function Tile({ label }: { label: string }) {
  const color = colorFor(label);
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[10.5px] font-bold"
      style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}
    >
      {monogram(label)}
    </span>
  );
}

function AddPicker({
  kind,
  options,
  onAdd,
  disabled,
}: {
  kind: LinkedLane["kind"];
  options: LinkedRecord[];
  onAdd: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useOutsideClick(
    ref,
    () => {
      setOpen(false);
      setQuery("");
    },
    open,
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  if (options.length === 0 || disabled) return null;
  const q = query.trim().toLowerCase();
  const hits = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q))
    : options;
  const noun = kind === "customers" ? "customer" : "person";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="group/add flex w-full cursor-pointer items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-line text-ink-3 transition-colors duration-150 group-hover/add:border-accent/60 group-hover/add:text-accent"
        >
          <Plus size={13} weight="bold" />
        </span>
        <span className="text-[13px] font-semibold text-ink-3 transition-colors duration-150 group-hover/add:text-accent">
          Link {noun}
        </span>
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute left-0 top-10 z-50 w-72 p-1.5">
          <div className="mb-1 flex items-center gap-2 border-b border-line-2 px-2 pb-2 pt-1">
            <MagnifyingGlass size={13} className="shrink-0 text-ink-3" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${kind}…`}
              aria-label={`Search ${kind}`}
              className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {hits.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onAdd(o.id);
                  close();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
              >
                <Tile label={o.label} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{o.label}</span>
                  {o.sub && <span className="block truncate text-[12px] text-ink-3">{o.sub}</span>}
                </span>
              </button>
            ))}
            {hits.length === 0 && <p className="px-2 py-2 text-[13px] text-ink-3">No match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Lane({ lane }: { lane: LinkedLane }) {
  const IconEl = lane.kind === "customers" ? Buildings : User;
  const label = lane.kind === "customers" ? "Customers" : "People";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5">
        <IconEl size={12} className="shrink-0 text-ink-3" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</span>
        <span className="font-mono text-[10.5px] font-semibold text-ink-3 tabular-nums">{lane.linked.length}</span>
        <span aria-hidden className="ml-1 h-px flex-1 bg-line-2" />
      </div>

      {/* The spine: rows hang off a hairline rail, each with a node dot in
          the record's identity color. */}
      <div className="relative pl-3">
        <span aria-hidden className="absolute bottom-2 left-[3px] top-1 w-px bg-line-2" />
        {lane.linked.map((l) => {
          const color = colorFor(l.label);
          const row = (
            <>
              <span
                aria-hidden
                className="absolute -left-3 top-1/2 h-[7px] w-[7px] -translate-x-[0.5px] -translate-y-1/2 rounded-full ring-2 ring-white"
                style={{ background: color }}
              />
              <Tile label={l.label} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{l.label}</span>
                {l.sub && <span className="block truncate text-[12px] text-ink-3">{l.sub}</span>}
              </span>
              {!lane.disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    lane.onRemove(l.id);
                  }}
                  aria-label={`Unlink ${l.label}`}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 opacity-0 transition-opacity duration-150 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover/row:opacity-100"
                >
                  <X size={12} weight="bold" />
                </button>
              )}
            </>
          );
          const rowClass =
            "group/row relative flex items-center gap-2.5 rounded-control px-1.5 py-1.5 transition-colors duration-150 hover:bg-surface-2";
          return l.href ? (
            <Link key={l.id} href={l.href} className={rowClass}>
              {row}
            </Link>
          ) : (
            <div key={l.id} className={rowClass}>
              {row}
            </div>
          );
        })}
        <div className="relative">
          <span
            aria-hidden
            className="absolute -left-3 top-1/2 h-[7px] w-[7px] -translate-x-[0.5px] -translate-y-1/2 rounded-full border border-dashed border-line bg-white"
          />
          <AddPicker kind={lane.kind} options={lane.options.filter((o) => !lane.linked.some((l) => l.id === o.id))} onAdd={lane.onAdd} disabled={lane.disabled} />
        </div>
        {lane.linked.length === 0 && lane.options.length === 0 && (
          <p className="px-1.5 py-1 text-[12.5px] text-ink-3">Nothing to link yet.</p>
        )}
      </div>
    </div>
  );
}

/** The lanes alone — drop into any container (Record's session rail). */
export function LinkedLanes({ lanes, columns = 1 }: { lanes: LinkedLane[]; columns?: 1 | 2 }) {
  return (
    <div className={`grid gap-4 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      {lanes.map((lane) => (
        <Lane key={lane.kind} lane={lane} />
      ))}
    </div>
  );
}

/** Card variant for the conversation workspace's summary column. */
export function FiledUnderPanel({ lanes }: { lanes: LinkedLane[] }) {
  return (
    <section data-rise className="surfaced px-4 py-4">
      <div className="mb-3">
        <h2 className="text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">Filed under</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">
          The accounts and people this conversation appears under.
        </p>
      </div>
      <LinkedLanes lanes={lanes} columns={2} />
    </section>
  );
}
