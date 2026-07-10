"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  BookmarkSimple,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CalendarCheck,
  CircleDashed,
  Link as LinkIcon,
  ListBullets,
  Microphone,
  Plus,
  SquaresFour,
  Trash,
  UsersThree,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Tabs } from "@/components/ui/tabs";
import type { CalendarEventKind, CalendarFeed, Customer } from "@/lib/fixtures";
import type { CalendarPageData, RealCalendarEvent, RealCalendarFeed } from "@/lib/data/calendar";
import {
  addCalendarEvent,
  addCalendarFeed,
  deleteCalendarEvent,
  removeCalendarFeed,
  manualSyncFeed,
  syncCalendarAvailability,
  updateCalendarEventTime,
} from "@/lib/data/calendar-actions";

// ─── Grid constants ─────────────────────────────────────────────────
// The week is a real 7-day, 24-hour canvas (weekend events used to be
// silently dropped by the fixture-era Mon-Fri template). ROW_H is the
// exact-pixel backbone shared by grid rows, event blocks, the now-line,
// and every drag computation — per DESIGN.md it must stay inline math.
const ROW_H = 56; // px per hour
const GAP = 2; // px gutter between side-by-side overlapping events
const GUTTER = 56; // px time-label column
const SNAP = 0.5; // drag snapping, in hours
const DAY_START_HOUR = 7; // where the canvas auto-scrolls on load

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type WeekDay = (typeof WEEK_DAYS)[number];
const GRID_HOURS = Array.from({ length: 24 }, (_, i) => i);

// Availability suggestions stay inside sane meeting hours on weekdays —
// the grid shows all 24x7, but nobody wants a 3 AM interview proposal.
const AVAIL_DAYS = WEEK_DAYS.slice(0, 5) as readonly WeekDay[];
const AVAIL_START = 8;
const AVAIL_HOURS = Array.from({ length: 10 }, (_, i) => AVAIL_START + i); // 08-17

// The calendar-view's own event shape: a real event bucketed into the
// currently-displayed week (fractional hours, 7-day WeekDay).
type WeekEvent = {
  id: string;
  feedId: string;
  ownerId: string;
  day: WeekDay;
  startHour: number;
  endHour: number;
  title: string;
  kind: CalendarEventKind;
  customerId?: string;
  allDay?: boolean;
};

const CALENDAR_COLORS = [
  "#d1614a", // Red/Coral
  "#d9b23c", // Gold
  "#2f9e63", // Green
  "#1f95a8", // Teal
  "#3d6fa6", // Blue
  "#6f5fb0", // Purple
  "#9aa4b5", // Gray
] as const;

const KIND_META: Record<CalendarEventKind, { label: string; icon: Icon }> = {
  interview: { label: "Interview", icon: CalendarCheck },
  recording: { label: "Recording", icon: Microphone },
  busy: { label: "Busy", icon: CircleDashed },
  hold: { label: "Hold", icon: BookmarkSimple },
};

function ColorSwatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CALENDAR_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          aria-label={`Use calendar color ${swatch}`}
          aria-pressed={value === swatch}
          className={`h-7 w-7 cursor-pointer rounded-md ring-offset-2 ring-offset-white transition-transform duration-150 hover:-translate-y-px ${
            value === swatch ? "ring-2 ring-accent" : "ring-1 ring-line-2"
          }`}
          style={{ background: swatch }}
        />
      ))}
    </div>
  );
}

// Monday of the week containing `d`.
function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtRange(monday: Date) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const startFmt = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endFmt = sunday.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${startFmt} - ${endFmt}`;
}

// 24-hour mono clock labels — matches the app's data voice everywhere else.
function fmtHour(h: number) {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function clampHour(h: number) {
  return Math.max(0, Math.min(24, h));
}

function snapHour(h: number) {
  return clampHour(Math.round(h / SNAP) * SNAP);
}

function syncLabel(f: CalendarFeed) {
  if (f.internal) return "Live";
  if (f.syncStatus === "error") return "Sync failed";
  if (f.syncStatus === "syncing") return "Syncing…";
  const m = f.lastSyncedMinutes ?? 0;
  return m < 60 ? `Synced ${m}m ago` : `Synced ${Math.round(m / 60)}h ago`;
}

function syncDotColor(f: CalendarFeed) {
  if (f.internal) return "#2f9e63";
  if (f.syncStatus === "error") return "#c0463a";
  if (f.syncStatus === "syncing") return "#d9b23c";
  return "#2f9e63";
}

// Simple greedy lane packing so overlapping events sit side by side instead
// of stacking on top of one another.
function layoutDay(events: WeekEvent[]) {
  const sorted = [...events].sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);
  const laneEnds: number[] = [];
  const placed: { event: WeekEvent; lane: number }[] = [];
  for (const e of sorted) {
    let lane = laneEnds.findIndex((end) => end <= e.startHour);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.endHour);
    } else {
      laneEnds[lane] = e.endHour;
    }
    placed.push({ event: e, lane });
  }
  const totalLanes = laneEnds.length || 1;
  return placed.map((p) => ({ ...p, totalLanes }));
}

// Longest contiguous free windows across the visible week, ranked so the
// most useful meeting-length gaps surface first instead of a wall of green.
function bestWindows(freeSlots: Record<WeekDay, boolean[]> | null, maxCount = 3) {
  if (!freeSlots) return [];
  const windows: { day: WeekDay; startHour: number; endHour: number; length: number }[] = [];
  for (const day of AVAIL_DAYS) {
    let runStart: number | null = null;
    for (let i = 0; i <= AVAIL_HOURS.length; i++) {
      const free = i < AVAIL_HOURS.length && freeSlots[day][i];
      if (free && runStart === null) runStart = i;
      if (!free && runStart !== null) {
        windows.push({ day, startHour: AVAIL_HOURS[runStart], endHour: AVAIL_HOURS[i - 1] + 1, length: i - runStart });
        runStart = null;
      }
    }
  }
  return windows.sort((a, b) => b.length - a.length).slice(0, maxCount);
}

// Event-block colors: a solid feed-color tint (Google-style), not the old
// border+wash mix. The hatched texture is reserved for OTHER people's
// busy-only availability blocks — your own synced events are real content
// and wear their feed color, even though ICS sync imports them as "busy".
function eventBlockStyle(event: WeekEvent, feedColor: string, isMine: boolean): React.CSSProperties {
  if (event.kind === "hold") {
    return { background: "transparent", border: "1.5px dashed var(--accent)", color: "var(--accent-strong)" };
  }
  if (event.kind === "busy" && !isMine) {
    return {
      background: `repeating-linear-gradient(135deg, rgba(23,32,43,0.06) 0 4px, rgba(23,32,43,0.02) 4px 8px)`,
      border: "1px solid var(--line)",
      color: "var(--ink-2)",
    };
  }
  return {
    background: `color-mix(in srgb, ${feedColor} 16%, white)`,
    border: `1px solid color-mix(in srgb, ${feedColor} 34%, white)`,
    color: "var(--ink)",
  };
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [href]')?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="anim-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,32,43,0.45)] px-4"
      onPointerDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
        className="anim-palette-in surfaced-lg w-105 max-w-full p-5"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EventDetail({
  event,
  feed,
  customers,
  canEdit,
  onClose,
  onDelete,
}: {
  event: WeekEvent;
  feed?: CalendarFeed;
  customers: Customer[];
  canEdit: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[event.kind];
  const IconEl = meta.icon;
  const customer = event.customerId ? customers.find((c) => c.id === event.customerId) : undefined;
  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold"
          style={{ background: `color-mix(in srgb, ${feed?.color ?? "#3d6fa6"} 14%, white)`, color: "var(--ink)" }}
        >
          <IconEl size={12} weight="bold" style={{ color: feed?.color ?? "#3d6fa6" }} />
          {meta.label}
        </span>
        <div className="flex items-center gap-2 text-[14px] text-ink-2">
          <CalendarBlank size={15} className="shrink-0 text-ink-3" />
          {event.day} ·{" "}
          <span className="font-mono text-[13px] tabular-nums">
            {event.allDay ? "All day" : `${fmtHour(event.startHour)} - ${fmtHour(event.endHour)}`}
          </span>
        </div>
        {feed && (
          <div className="flex items-center gap-2 text-[14px] text-ink-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: feed.color }} />
            {feed.label}
            <span className="text-[12px] text-ink-3">· {syncLabel(feed)}</span>
          </div>
        )}
        {customer && (
          <Link
            href={`/customers/${customer.id}`}
            className="recessed flex items-center justify-between px-3 py-2.5 text-[13.5px] font-semibold text-accent transition-colors duration-150 hover:bg-[rgba(23,32,43,0.10)]"
          >
            Open {customer.name}
            <CaretRight size={13} />
          </Link>
        )}
        {!canEdit && (
          <p className="text-[12.5px] leading-snug text-ink-3">
            Synced from a connected calendar — edit it in its source calendar and it updates here on the next sync.
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="h-9 cursor-pointer rounded-md px-3.5 text-[14px] font-bold text-danger transition-colors duration-150 hover:bg-danger/10"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="h-9 cursor-pointer rounded-md bg-accent px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

function AddEventForm({
  draft,
  feeds,
  customers,
  currentUserId,
  onSave,
  onClose,
}: {
  draft: { day: WeekDay; hour: number; endHour?: number };
  feeds: CalendarFeed[];
  customers: Customer[];
  currentUserId: string;
  onSave: (event: Omit<WeekEvent, "id">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CalendarEventKind>("hold");
  const [day, setDay] = useState<WeekDay>(draft.day);
  const [start, setStart] = useState(draft.hour);
  const [end, setEnd] = useState(draft.endHour ?? Math.min(draft.hour + 1, 24));
  const [allDay, setAllDay] = useState(false);
  const [feedId, setFeedId] = useState(feeds.find((f) => f.internal)?.id ?? feeds[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");

  const halfHours = Array.from({ length: 48 }, (_, i) => i * 0.5);

  const save = () => {
    const t = title.trim();
    if (!t || (!allDay && end <= start)) return;
    const feed = feeds.find((f) => f.id === feedId);
    onSave({
      feedId,
      ownerId: feed?.ownerId ?? currentUserId,
      day,
      startHour: allDay ? 0 : start,
      endHour: allDay ? 24 : end,
      title: t,
      kind,
      customerId: customerId || undefined,
      allDay: allDay || undefined,
    });
  };

  return (
    <Modal title="New event" onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="Event title"
          aria-label="Event title"
          className="recessed h-10 w-full px-3 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
        />
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as CalendarEventKind)} aria-label="Kind" className="recessed h-9 flex-1 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none">
            {(Object.keys(KIND_META) as CalendarEventKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].label}
              </option>
            ))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value as WeekDay)} aria-label="Day" className="recessed h-9 flex-1 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none">
            {WEEK_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-2">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-3.5 w-3.5 cursor-pointer accent-[#3d6fa6]" />
          All day
        </label>
        {!allDay && (
          <div className="flex gap-2">
            <select
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              aria-label="Start time"
              className="recessed h-9 flex-1 cursor-pointer px-2.5 font-mono text-[13px] text-ink outline-none"
            >
              {halfHours.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
            <select
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
              aria-label="End time"
              className="recessed h-9 flex-1 cursor-pointer px-2.5 font-mono text-[13px] text-ink outline-none"
            >
              {[...halfHours.slice(1), 24].map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
          </div>
        )}
        <select value={feedId} onChange={(e) => setFeedId(e.target.value)} aria-label="Calendar" className="recessed h-9 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none">
          {feeds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {(kind === "interview" || kind === "recording") && (
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Linked account" className="recessed h-9 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none">
            <option value="">No linked account</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 cursor-pointer rounded-md px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2">
          Cancel
        </button>
        <button type="button" onClick={save} className="h-9 cursor-pointer rounded-md bg-accent px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong">
          Add event
        </button>
      </div>
    </Modal>
  );
}

// ─── Sidebar: mini month ────────────────────────────────────────────
// Flat instrument (no card box): month paging arrows, event-density dots
// under days that have anything scheduled, today ringed, shown week banded.
function MiniMonth({
  weekStart,
  todayKey,
  eventDays,
  onPick,
}: {
  weekStart: Date;
  todayKey: string | null;
  eventDays: Set<string>;
  onPick: (d: Date) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const anchor = useMemo(() => {
    const a = new Date(weekStart.getFullYear(), weekStart.getMonth() + monthOffset, 1);
    return a;
  }, [weekStart, monthOffset]);

  const gridStart = startOfWeek(anchor);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13.5px] font-bold text-ink">{monthLabel}</span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            aria-label="Previous month"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <CaretLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            aria-label="Next month"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <CaretRight size={13} />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center font-mono text-[10px] font-bold text-ink-3">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const key = d.toDateString();
          const isToday = todayKey === key;
          const inWeek = d >= weekStart && d <= weekEnd;
          const hasEvents = eventDays.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onPick(d);
                setMonthOffset(0);
              }}
              className={`relative mx-auto flex h-7 w-7 cursor-pointer flex-col items-center justify-center rounded-full font-mono text-[11.5px] tabular-nums transition-colors duration-150 ${
                isToday
                  ? "bg-accent font-bold text-white"
                  : inWeek
                    ? "bg-accent-soft font-semibold text-ink"
                    : inMonth
                      ? "text-ink-2 hover:bg-surface-2"
                      : "text-ink-3/40 hover:bg-surface-2"
              }`}
            >
              {d.getDate()}
              {hasEvents && !isToday && (
                <span aria-hidden className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({
  weekDates,
  todayIndex,
  events,
  feeds,
  customers,
  onSelect,
}: {
  weekDates: { day: WeekDay; date: Date }[];
  todayIndex: number;
  events: WeekEvent[];
  feeds: CalendarFeed[];
  customers: Customer[];
  onSelect: (e: WeekEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-6 p-5">
      {weekDates.map(({ day, date }, i) => {
        const dayEvents = events
          .filter((e) => e.day === day)
          .sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || a.startHour - b.startHour);
        return (
          <div key={day}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12.5px] font-bold tabular-nums ${
                  i === todayIndex ? "bg-accent text-white" : "bg-[rgba(23,32,43,0.07)] text-ink-2"
                }`}
              >
                {date.getDate()}
              </span>
              <span className="text-[14px] font-semibold text-ink">
                {date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </span>
              {i === todayIndex && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">Today</span>
              )}
              <span className="ml-auto font-mono text-[12px] text-ink-3 tabular-nums">{dayEvents.length}</span>
            </div>
            {dayEvents.length === 0 ? (
              <p className="recessed px-4 py-3 text-[13.5px] text-ink-2">Nothing scheduled.</p>
            ) : (
              <div className="flex flex-col divide-y divide-line-2 pl-1">
                {dayEvents.map((e) => {
                  const feed = feeds.find((f) => f.id === e.feedId);
                  const meta = KIND_META[e.kind];
                  const IconEl = meta.icon;
                  const customer = e.customerId ? customers.find((c) => c.id === e.customerId) : undefined;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onSelect(e)}
                      className="grid cursor-pointer items-center gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
                      style={{ gridTemplateColumns: "24px 92px minmax(0,1fr) 150px" }}
                    >
                      <span
                        className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `${feed?.color ?? "#3d6fa6"}22`, color: feed?.color ?? "#3d6fa6" }}
                      >
                        <IconEl size={11} weight="bold" />
                      </span>
                      <span className="font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                        {e.allDay ? "All day" : fmtHour(e.startHour)}
                      </span>
                      <span className="min-w-0 truncate text-[14px] font-semibold text-ink" title={e.title}>
                        {e.title}
                      </span>
                      {customer ? (
                        <span className="truncate text-[12.5px] font-bold text-accent">{customer.name}</span>
                      ) : (
                        <span className="truncate text-[12.5px] text-ink-3">{feed?.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function toFeedShape(f: RealCalendarFeed): CalendarFeed {
  return {
    id: f.id,
    ownerId: f.ownerId,
    label: f.label,
    color: f.color,
    visibility: f.visibility,
    internal: f.internal,
    syncStatus: f.syncStatus,
    lastSyncedMinutes: f.lastSyncedMinutes,
  };
}

// Real events carry absolute timestamps; this buckets one into whichever
// day of the currently-displayed week it actually falls on (or drops it if
// it isn't in this week at all — real navigation, not a repeated template).
function toWeekEvent(e: RealCalendarEvent, weekDates: { day: WeekDay; date: Date }[]): WeekEvent | null {
  const match = weekDates.find((w) => w.date.toDateString() === e.startAt.toDateString());
  if (!match) return null;
  const startHour = e.allDay ? 0 : e.startAt.getHours() + e.startAt.getMinutes() / 60;
  const endHour = e.allDay ? 24 : e.endAt.getHours() + e.endAt.getMinutes() / 60;
  return {
    id: e.id,
    feedId: e.feedId,
    ownerId: e.ownerId,
    day: match.day,
    startHour,
    endHour: Math.max(endHour, startHour + 0.25),
    title: e.title,
    kind: e.kind,
    customerId: e.customerId,
    allDay: e.allDay || undefined,
  };
}

export function CalendarView({
  feeds: initialFeeds,
  events: initialEvents,
  owners,
  customers,
  currentUserId,
}: CalendarPageData & { currentUserId: string }) {
  const [visibleFeedIds, setVisibleFeedIds] = useState<Set<string>>(
    new Set(initialFeeds.filter((f) => f.ownerId === currentUserId).map((f) => f.id)),
  );
  const [availabilityWith, setAvailabilityWith] = useState<Set<string>>(new Set());
  const [availabilitySyncing, setAvailabilitySyncing] = useState<Set<string>>(new Set());
  const [availabilityErrors, setAvailabilityErrors] = useState<Map<string, string>>(new Map());
  const [newFeedName, setNewFeedName] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newFeedColor, setNewFeedColor] = useState("#d1614a");
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [feeds, setFeeds] = useState<CalendarFeed[]>(() => initialFeeds.map(toFeedShape));
  const [rawEvents, setRawEvents] = useState<RealCalendarEvent[]>(initialEvents);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"week" | "agenda">("week");
  const [selectedEvent, setSelectedEvent] = useState<WeekEvent | null>(null);
  const [addDraft, setAddDraft] = useState<{ day: WeekDay; hour: number; endHour?: number } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Drag state: creating a range on empty grid, or moving an existing block.
  // Each ghost is mirrored into a ref so pointer-up handlers can read the
  // final value without doing side effects inside a setState updater
  // (updaters must stay pure — React flags setState/server-action calls
  // made from inside them).
  const [createGhost, setCreateGhost] = useState<{ day: WeekDay; start: number; end: number } | null>(null);
  const [moveGhost, setMoveGhost] = useState<{ eventId: string; day: WeekDay; startHour: number } | null>(null);
  const createGhostRef = useRef<typeof createGhost>(null);
  const moveGhostRef = useRef<typeof moveGhost>(null);
  const applyCreateGhost = useCallback((g: { day: WeekDay; start: number; end: number } | null) => {
    createGhostRef.current = g;
    setCreateGhost(g);
  }, []);
  const applyMoveGhost = useCallback((g: { eventId: string; day: WeekDay; startHour: number } | null) => {
    moveGhostRef.current = g;
    setMoveGhost(g);
  }, []);
  const dragRef = useRef<
    | { mode: "create"; day: WeekDay; anchor: number; moved: boolean }
    | { mode: "move"; event: WeekEvent; grabOffset: number; moved: boolean }
    | null
  >(null);
  const suppressClickRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real clock, client-only (avoids a server/client render mismatch on load).
  // Both ticks happen inside timer callbacks, not synchronously in the effect
  // body, same convention as recording-provider.tsx's elapsed-time interval.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  // The 24h canvas opens scrolled to the working morning, not midnight.
  useEffect(() => {
    if (view !== "week") return;
    scrollRef.current?.scrollTo({ top: DAY_START_HOUR * ROW_H - 8 });
  }, [view]);

  const monday = useMemo(() => {
    const base = startOfWeek(now ?? new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [now, weekOffset]);

  const weekDates = useMemo(
    () => WEEK_DAYS.map((day, i) => ({ day, date: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i) })),
    [monday],
  );

  const todayIndex = useMemo(() => {
    if (!now || weekOffset !== 0) return -1;
    return weekDates.findIndex((w) => w.date.toDateString() === now.toDateString());
  }, [now, weekOffset, weekDates]);

  const myFeeds = useMemo(
    () => feeds.filter((feed) => feed.ownerId === currentUserId),
    [feeds, currentUserId],
  );
  const visibleMyFeeds = useMemo(
    () => myFeeds.filter((feed) => visibleFeedIds.has(feed.id)),
    [myFeeds, visibleFeedIds],
  );
  const ownerById = useMemo(
    () => new Map(owners.map((owner) => [owner.id, owner])),
    [owners],
  );
  const selectedOwners = useMemo(
    () => owners.filter((owner) => availabilityWith.has(owner.id)),
    [owners, availabilityWith],
  );
  // Bucket each real event (absolute timestamp) into whichever day of the
  // currently-displayed week it actually falls on — genuine week
  // navigation, not the fixture's single repeated template week.
  const weekEvents = useMemo(() => rawEvents.map((e) => toWeekEvent(e, weekDates)).filter((e): e is WeekEvent => e != null), [rawEvents, weekDates]);
  const shownEvents = weekEvents.filter((e) => visibleFeedIds.has(e.feedId));

  // Which dates carry events, for the mini month's density dots.
  const eventDays = useMemo(() => new Set(rawEvents.map((e) => e.startAt.toDateString())), [rawEvents]);

  const jumpToDate = (d: Date) => {
    const base = startOfWeek(now ?? new Date());
    const target = startOfWeek(d);
    const diffWeeks = Math.round((target.getTime() - base.getTime()) / (7 * 86_400_000));
    setWeekOffset(diffWeeks);
  };

  const toggleFeed = (id: string) => {
    setVisibleFeedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addFeed = async () => {
    const url = newFeedUrl.trim();
    if (!url || isAddingFeed) return;
    const label = newFeedName.trim() || "New calendar";
    setIsAddingFeed(true);
    try {
      const { id, syncResult, events } = await addCalendarFeed({
        ownerId: currentUserId,
        label,
        url,
        color: newFeedColor,
      });
      const feed: CalendarFeed = {
        id,
        ownerId: currentUserId,
        label,
        color: newFeedColor,
        visibility: "busy_only",
        syncStatus: syncResult?.success === false ? "error" : "synced",
        lastSyncedMinutes: 0,
      };
      setFeeds((fs) => [...fs, feed]);
      setVisibleFeedIds((prev) => new Set(prev).add(id));
      setRawEvents((current) => [...current, ...events]);
      setNewFeedName("");
      setNewFeedUrl("");
      setNewFeedColor("#d1614a");
      setShowAddFeed(false);
    } finally {
      setIsAddingFeed(false);
    }
  };

  const removeFeed = (id: string) => {
    setFeeds((fs) => fs.filter((f) => f.id !== id));
    setVisibleFeedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    void removeCalendarFeed(id);
  };

  const syncFeed = (feed: CalendarFeed) => {
    setFeeds((current) => current.map((item) => item.id === feed.id
      ? { ...item, syncStatus: "syncing" as const, lastSyncedMinutes: 0 }
      : item));
    void manualSyncFeed(feed.id).then((result) => {
      setFeeds((current) => current.map((item) => item.id === feed.id
        ? { ...item, syncStatus: result.error ? "error" as const : "synced" as const, lastSyncedMinutes: 0 }
        : item));
      if (!result.error) {
        setRawEvents((current) => [
          ...current.filter((event) => event.feedId !== feed.id),
          ...result.events,
        ]);
      }
    }).catch(() => {
      setFeeds((current) => current.map((item) => item.id === feed.id
        ? { ...item, syncStatus: "error" as const }
        : item));
    });
  };

  const toggleAvailability = async (ownerId: string) => {
    if (availabilityWith.has(ownerId)) {
      setAvailabilityWith((current) => {
        const next = new Set(current);
        next.delete(ownerId);
        return next;
      });
      setRawEvents((current) => current.filter((event) => event.ownerId !== ownerId));
      return;
    }

    setAvailabilitySyncing((current) => new Set(current).add(ownerId));
    setAvailabilityErrors((current) => {
      const next = new Map(current);
      next.delete(ownerId);
      return next;
    });

    try {
      const result = await syncCalendarAvailability(ownerId);
      if (!result.success) {
        setAvailabilityErrors((current) => new Map(current).set(ownerId, result.error || "Couldn’t sync"));
        return;
      }

      setRawEvents((current) => [
        ...current.filter((event) => event.ownerId !== ownerId),
        ...result.events,
      ]);
      setAvailabilityWith((current) => new Set(current).add(ownerId));
      setView("week");
    } catch (error) {
      setAvailabilityErrors((current) => new Map(current).set(
        ownerId,
        error instanceof Error ? error.message : "Couldn’t sync",
      ));
    } finally {
      setAvailabilitySyncing((current) => {
        const next = new Set(current);
        next.delete(ownerId);
        return next;
      });
    }
  };

  // A slot is free only when every selected person (and the current user)
  // is free. Busy owner ids drive the per-person markers in the grid.
  // Computed over weekday meeting hours (AVAIL_*), not the whole canvas.
  const availability = useMemo(() => {
    if (availabilityWith.size === 0) return null;
    const people = [currentUserId, ...availabilityWith];
    const eventsByPerson = new Map(
      people.map((id) => [id, weekEvents.filter((event) => event.ownerId === id)]),
    );
    const free = {} as Record<WeekDay, boolean[]>;
    const busyOwners = {} as Record<WeekDay, string[][]>;

    for (const day of WEEK_DAYS) {
      free[day] = [];
      busyOwners[day] = [];
      for (const hour of AVAIL_HOURS) {
        const isBusy = (ownerId: string) => (eventsByPerson.get(ownerId) ?? []).some((event) =>
          event.day === day && (event.allDay || (hour < event.endHour && hour + 1 > event.startHour)),
        );
        free[day].push((AVAIL_DAYS as readonly string[]).includes(day) && people.every((ownerId) => !isBusy(ownerId)));
        busyOwners[day].push(selectedOwners.filter((owner) => isBusy(owner.id)).map((owner) => owner.id));
      }
    }
    return { free, busyOwners };
  }, [availabilityWith, weekEvents, currentUserId, selectedOwners]);

  const freeSlots = availability?.free ?? null;

  const suggestedSlots = useMemo(() => bestWindows(freeSlots), [freeSlots]);

  const addEvent = (draft: Omit<WeekEvent, "id">) => {
    setAddDraft(null);
    const match = weekDates.find((w) => w.day === draft.day);
    if (!match) return;
    const startAt = new Date(match.date);
    startAt.setHours(Math.floor(draft.startHour), Math.round((draft.startHour % 1) * 60), 0, 0);
    const endAt = new Date(match.date);
    endAt.setHours(Math.floor(draft.endHour), Math.round((draft.endHour % 1) * 60), 0, 0);
    void addCalendarEvent({
      feedId: draft.feedId,
      ownerId: draft.ownerId,
      title: draft.title,
      kind: draft.kind,
      customerId: draft.customerId,
      allDay: Boolean(draft.allDay),
      startAt,
      endAt,
    }).then(({ id }) => {
      setRawEvents((evs) => [
        ...evs,
        { id, feedId: draft.feedId, ownerId: draft.ownerId, title: draft.title, kind: draft.kind, customerId: draft.customerId, allDay: Boolean(draft.allDay), startAt, endAt },
      ]);
    });
  };

  const deleteEvent = (id: string) => {
    setRawEvents((evs) => evs.filter((e) => e.id !== id));
    setSelectedEvent(null);
    void deleteCalendarEvent(id);
  };

  // Only events created here (internal feed, owned by me) are editable —
  // synced ICS events get clobbered back on the next sync.
  const canEditEvent = useCallback(
    (event: WeekEvent) => {
      const feed = feeds.find((f) => f.id === event.feedId);
      return Boolean(feed?.internal && event.ownerId === currentUserId);
    },
    [feeds, currentUserId],
  );

  // ─── Drag mechanics ───────────────────────────────────────────────
  // One shared coordinate helper: pointer position → (day, fractional hour)
  // against the week body's live geometry.
  const pointToSlot = useCallback((clientX: number, clientY: number) => {
    const body = bodyRef.current;
    if (!body) return null;
    const rect = body.getBoundingClientRect();
    const colW = (rect.width - GUTTER) / WEEK_DAYS.length;
    const dayIndex = Math.max(0, Math.min(WEEK_DAYS.length - 1, Math.floor((clientX - rect.left - GUTTER) / colW)));
    const hour = clampHour((clientY - rect.top) / ROW_H);
    return { day: WEEK_DAYS[dayIndex], hour };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const slot = pointToSlot(e.clientX, e.clientY);
      if (!slot) return;

      if (drag.mode === "create") {
        const a = drag.anchor;
        const b = snapHour(slot.hour);
        if (!drag.moved && Math.abs(b - a) < SNAP) return;
        drag.moved = true;
        const start = Math.min(a, b);
        const end = Math.max(a, b, start + SNAP);
        applyCreateGhost({ day: drag.day, start, end });
      } else {
        const startHour = snapHour(slot.hour - drag.grabOffset);
        const duration = drag.event.endHour - drag.event.startHour;
        const clamped = Math.max(0, Math.min(24 - duration, startHour));
        if (!drag.moved && clamped === drag.event.startHour && slot.day === drag.event.day) return;
        drag.moved = true;
        applyMoveGhost({ eventId: drag.event.id, day: slot.day, startHour: clamped });
      }
    };

    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;

      // Swallow the click this pointerup may synthesize — and clear the
      // flag on the next tick, because a drag that ends over a different
      // element than it started on produces NO click at all, which would
      // otherwise leave the flag armed to eat the next real click.
      if (drag.moved) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      // Final ghost values come from the refs — side effects (opening the
      // form, persisting the move) must not run inside setState updaters.
      if (drag.mode === "create") {
        const ghost = createGhostRef.current;
        if (drag.moved && ghost) {
          setAddDraft({ day: ghost.day, hour: ghost.start, endHour: ghost.end });
        }
        applyCreateGhost(null);
      } else {
        const ghost = moveGhostRef.current;
        if (drag.moved && ghost) {
          const match = weekDates.find((w) => w.day === ghost.day);
          const duration = drag.event.endHour - drag.event.startHour;
          if (match) {
            const startAt = new Date(match.date);
            startAt.setHours(Math.floor(ghost.startHour), Math.round((ghost.startHour % 1) * 60), 0, 0);
            const endAt = new Date(startAt.getTime() + duration * 3_600_000);
            setRawEvents((evs) => evs.map((ev) => (ev.id === drag.event.id ? { ...ev, startAt, endAt } : ev)));
            void updateCalendarEventTime({ id: drag.event.id, startAt, endAt });
          }
        }
        applyMoveGhost(null);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pointToSlot, weekDates, applyCreateGhost, applyMoveGhost]);

  const beginCreateDrag = (day: WeekDay) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const slot = pointToSlot(e.clientX, e.clientY);
    if (!slot) return;
    dragRef.current = { mode: "create", day, anchor: snapHour(slot.hour), moved: false };
  };

  const beginMoveDrag = (event: WeekEvent) => (e: React.PointerEvent) => {
    if (e.button !== 0 || event.allDay || !canEditEvent(event)) return;
    const slot = pointToSlot(e.clientX, e.clientY);
    if (!slot) return;
    dragRef.current = { mode: "move", event, grabOffset: slot.hour - event.startHour, moved: false };
  };

  // Swallow exactly one click after a completed drag so the hour-cell
  // button underneath (or the event's own open-detail click) doesn't fire.
  const onGridClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const nowHour = now ? now.getHours() + now.getMinutes() / 60 : null;
  const todaysMeetings =
    todayIndex >= 0 ? shownEvents.filter((e) => e.day === weekDates[todayIndex].day && !e.allDay).length : 0;

  const monthTitle = monday.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Calendar"
        icon={CalendarBlank}
        meta="Your calendars in one week — with private, busy-only availability for the people you compare."
        actions={
          <>
            <HeaderStat label="Today" value={todaysMeetings} />
            <HeaderStat label="Interviews this week" value={shownEvents.filter((e) => e.kind === "interview").length} divider />
            <HeaderStat label="Calendars shown" value={visibleMyFeeds.length} divider />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1680px] flex-col gap-6 px-4 py-5 sm:px-6 xl:flex-row xl:gap-8 xl:px-8">
        {/* ─── Sidebar: a quiet instrument rail, not a stack of boxes ─── */}
        <aside className="grid w-full shrink-0 gap-6 md:grid-cols-3 xl:flex xl:w-[264px] xl:flex-col xl:gap-6">
          <section className="border-b border-line pb-5 md:border-b-0 md:pb-0 xl:border-b xl:pb-6">
            <MiniMonth
              weekStart={monday}
              todayKey={now ? now.toDateString() : null}
              eventDays={eventDays}
              onPick={jumpToDate}
            />
          </section>

          <section className="flex flex-col gap-3 border-b border-line pb-5 md:border-b-0 md:pb-0 xl:border-b xl:pb-6">
            <SectionHeader
              count={visibleMyFeeds.length}
              action={
                <button
                  type="button"
                  onClick={() => setShowAddFeed((current) => !current)}
                  aria-expanded={showAddFeed}
                  className="flex items-center gap-1 text-[12.5px] font-bold text-accent transition-colors duration-150 hover:text-accent-strong"
                >
                  {showAddFeed ? <X size={12} /> : <Plus size={12} weight="bold" />}
                  {showAddFeed ? "Close" : "Connect"}
                </button>
              }
            >
              My calendars
            </SectionHeader>
            <div className="flex flex-col">
              {myFeeds.map((feed) => {
                const visible = visibleFeedIds.has(feed.id);
                return (
                  <div key={feed.id} className="group flex min-h-10 items-center gap-2.5 rounded-control px-1.5 transition-colors duration-150 hover:bg-surface-2">
                    <button
                      type="button"
                      onClick={() => toggleFeed(feed.id)}
                      aria-pressed={visible}
                      aria-label={`${visible ? "Hide" : "Show"} ${feed.label}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-2 text-left"
                    >
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0 rounded-[4px] transition-colors duration-150"
                        style={
                          visible
                            ? { background: feed.color }
                            : { background: "transparent", boxShadow: `inset 0 0 0 1.5px ${feed.color}` }
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13.5px] font-semibold ${visible ? "text-ink" : "text-ink-3"}`}>
                          {feed.label}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: syncDotColor(feed) }} aria-hidden />
                          {syncLabel(feed)}
                        </span>
                      </span>
                    </button>
                    {feed.internal ? (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-3">Local</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => syncFeed(feed)}
                          aria-label={`Sync ${feed.label}`}
                          disabled={feed.syncStatus === "syncing"}
                          className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-accent-soft hover:text-accent disabled:cursor-wait ${
                            feed.syncStatus === "error" ? "text-danger" : ""
                          }`}
                          title={feed.syncStatus === "error" ? "Sync failed — click to retry" : "Sync now"}
                        >
                          <ArrowsClockwise size={13} className={feed.syncStatus === "syncing" ? "animate-spin" : ""} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFeed(feed.id)}
                          aria-label={`Remove ${feed.label}`}
                          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash size={13} />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {showAddFeed && (
              <div className="surfaced flex flex-col gap-3 p-3.5">
                <div>
                  <label htmlFor="calendar-name" className="mb-1.5 block text-[12px] font-semibold text-ink-2">Calendar name</label>
                  <input
                    id="calendar-name"
                    value={newFeedName}
                    onChange={(event) => setNewFeedName(event.target.value)}
                    placeholder="For example, Outlook"
                    className="recessed h-10 w-full px-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
                  />
                </div>
                <div>
                  <label htmlFor="calendar-url" className="mb-1.5 block text-[12px] font-semibold text-ink-2">Published ICS link</label>
                  <div className="recessed flex h-10 items-center gap-2 px-3">
                    <LinkIcon size={14} className="shrink-0 text-ink-3" />
                    <input
                      id="calendar-url"
                      value={newFeedUrl}
                      onChange={(event) => setNewFeedUrl(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && void addFeed()}
                      placeholder="https://…/calendar.ics"
                      className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
                    />
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-[12px] font-semibold text-ink-2">Color</span>
                  <ColorSwatches value={newFeedColor} onChange={setNewFeedColor} />
                </div>
                <button
                  type="button"
                  onClick={() => void addFeed()}
                  disabled={!newFeedUrl.trim() || isAddingFeed}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isAddingFeed ? <ArrowsClockwise size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}
                  {isAddingFeed ? "Connecting…" : "Connect calendar"}
                </button>
                <p className="text-[12px] leading-snug text-ink-3">
                  Teammates receive busy-only availability. Calendar names and event details stay private.
                </p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader icon={<UsersThree size={14} />} count={selectedOwners.length}>Compare people</SectionHeader>
            <div className="flex flex-col">
              {owners.filter((owner) => owner.id !== currentUserId).length === 0 ? (
                <p className="py-1 text-[13.5px] leading-snug text-ink-3">No teammates are available yet.</p>
              ) : owners
                .filter((owner) => owner.id !== currentUserId)
                .map((owner) => {
                  const isSelected = availabilityWith.has(owner.id);
                  const isSyncing = availabilitySyncing.has(owner.id);
                  return (
                    <button
                      key={owner.id}
                      type="button"
                      onClick={() => void toggleAvailability(owner.id)}
                      disabled={isSyncing}
                      aria-pressed={isSelected}
                      className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors duration-150 disabled:cursor-wait disabled:opacity-70 ${
                        isSelected ? "bg-accent-soft" : "hover:bg-surface-2"
                      }`}
                    >
                      <Avatar owner={owner} size={26} />
                      <span className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${isSelected ? "text-ink" : "text-ink-2"}`}>
                        {owner.name}
                      </span>
                      {isSyncing ? (
                        <ArrowsClockwise size={13} className="shrink-0 animate-spin text-ink-3" />
                      ) : availabilityErrors.has(owner.id) ? (
                        <span className="shrink-0 text-[11px] font-semibold text-danger" title={availabilityErrors.get(owner.id)}>
                          Couldn’t sync
                        </span>
                      ) : isSelected ? (
                        <X size={12} className="shrink-0 text-ink-3" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
            </div>
            {freeSlots && (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">Best shared times</span>
                {suggestedSlots.length === 0 ? (
                  <p className="recessed px-3 py-2.5 text-[13.5px] leading-snug text-ink-2">No shared opening this week.</p>
                ) : suggestedSlots.map((window) => (
                  <button
                    key={`${window.day}-${window.startHour}`}
                    type="button"
                    onClick={() => setAddDraft({ day: window.day, hour: window.startHour, endHour: Math.min(window.startHour + 1, window.endHour) })}
                    className="recessed group flex min-h-9 cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-accent-soft"
                  >
                    <span className="text-[13px] font-semibold text-ink">
                      {window.day}{" "}
                      <span className="font-mono text-[12px] font-bold tabular-nums text-ink-2">
                        {fmtHour(window.startHour)} - {fmtHour(window.endHour)}
                      </span>
                    </span>
                    <Plus size={13} className="shrink-0 text-accent" weight="bold" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        {/* ─── The calendar canvas ─── */}
        <div className="min-w-0 flex-1">
          <div className="surfaced overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="h-9 cursor-pointer rounded-control border border-line px-3 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink"
                >
                  Today
                </button>
                <span className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setWeekOffset((week) => week - 1)}
                    aria-label="Previous week"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                  >
                    <CaretLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekOffset((week) => week + 1)}
                    aria-label="Next week"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                  >
                    <CaretRight size={15} />
                  </button>
                </span>
                <span className="ml-1 flex items-baseline gap-2">
                  <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{monthTitle}</span>
                  <span className="hidden font-mono text-[11.5px] font-semibold text-ink-3 tabular-nums sm:inline">{fmtRange(monday)}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tabs
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "week", label: "Week", icon: SquaresFour },
                    { value: "agenda", label: "Agenda", icon: ListBullets },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => setAddDraft({ day: weekDates[todayIndex >= 0 ? todayIndex : 0].day, hour: 9 })}
                  className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-control bg-accent px-3.5 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
                >
                  <Plus size={14} weight="bold" />
                  New event
                </button>
              </div>
            </div>

            {freeSlots && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line-2 bg-surface-2/45 px-4 py-2">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                  <UsersThree size={13} className="text-ink-3" />
                  Comparing {selectedOwners.map((o) => o.name.split(" ")[0]).join(", ")}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-data-green/60" aria-hidden />
                  Free for everyone
                </span>
                <span className="text-[12px] text-ink-3">Person-colored dots mark who is busy.</span>
              </div>
            )}

            {view === "agenda" ? (
              <AgendaView weekDates={weekDates} todayIndex={todayIndex} events={shownEvents} feeds={feeds} customers={customers} onSelect={setSelectedEvent} />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  {/* Sticky header: day names + all-day lane */}
                  <div
                    ref={scrollRef}
                    className="relative max-h-[calc(100dvh-300px)] min-h-[420px] overflow-y-auto overscroll-contain"
                    onClickCapture={onGridClickCapture}
                  >
                    <div className="sticky top-0 z-20 border-b border-line bg-surface">
                      <div className="grid" style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` }}>
                        <div />
                        {weekDates.map(({ day, date }, i) => (
                          <div key={day} className={`flex items-center justify-center gap-1.5 border-l border-line-2 py-2 ${i >= 5 ? "bg-ink/[0.02]" : ""}`}>
                            <span className={`text-[12px] font-bold uppercase tracking-[0.08em] ${i === todayIndex ? "text-accent" : "text-ink-3"}`}>
                              {day}
                            </span>
                            <span
                              className={`flex h-6.5 w-6.5 items-center justify-center rounded-full font-mono text-[12.5px] font-bold tabular-nums ${
                                i === todayIndex ? "bg-accent text-white" : "text-ink-2"
                              }`}
                            >
                              {date.getDate()}
                            </span>
                          </div>
                        ))}
                      </div>
                      {shownEvents.some((e) => e.allDay) && (
                        <div className="grid border-t border-line-2" style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` }}>
                          <div className="flex items-center justify-end pr-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                            all-day
                          </div>
                          {weekDates.map(({ day }, i) => {
                            const allDayEvents = shownEvents.filter((e) => e.day === day && e.allDay);
                            return (
                              <div key={`allday-${day}`} className={`flex min-h-7 flex-col gap-1 border-l border-line-2 px-1 py-1 ${i >= 5 ? "bg-ink/[0.02]" : ""}`}>
                                {allDayEvents.map((e) => {
                                  const feed = feeds.find((f) => f.id === e.feedId);
                                  return (
                                    <button
                                      key={e.id}
                                      type="button"
                                      data-event
                                      onClick={() => setSelectedEvent(e)}
                                      title={e.title}
                                      className="cursor-pointer truncate rounded-[6px] px-1.5 py-0.5 text-left text-[11px] font-bold transition-shadow duration-150 hover:shadow-[0_2px_6px_rgba(23,32,43,0.2)]"
                                      style={{
                                        background: `color-mix(in srgb, ${feed?.color ?? "#3d6fa6"} 18%, white)`,
                                        color: "var(--ink)",
                                      }}
                                    >
                                      {e.title}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Body: time gutter + 7 day columns, 24h tall */}
                    <div ref={bodyRef} className="grid" style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` }}>
                      <div className="relative flex flex-col">
                        {GRID_HOURS.map((h) => (
                          <div key={h} style={{ height: ROW_H }} className="relative">
                            {h > 0 && (
                              <span className="absolute -top-[7px] right-2.5 bg-surface px-0.5 font-mono text-[10.5px] text-ink-3 tabular-nums">
                                {fmtHour(h)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {weekDates.map(({ day }, i) => {
                        const dayEvents = shownEvents.filter((e) => e.day === day && !e.allDay);
                        const laid = layoutDay(dayEvents);
                        const isWeekend = i >= 5;
                        return (
                          <div
                            key={day}
                            onPointerDown={beginCreateDrag(day)}
                            className={`relative select-none border-l border-line-2 ${
                              i === todayIndex ? "bg-accent/[0.045]" : isWeekend ? "bg-ink/[0.02]" : ""
                            }`}
                          >
                            {GRID_HOURS.map((hour) => {
                              const availIdx = hour - AVAIL_START;
                              const inAvail = availIdx >= 0 && availIdx < AVAIL_HOURS.length;
                              const busyOwnerIds = inAvail ? availability?.busyOwners[day][availIdx] ?? [] : [];
                              const busyNames = busyOwnerIds
                                .map((ownerId) => ownerById.get(ownerId)?.name)
                                .filter((name): name is string => Boolean(name));
                              const isFree = inAvail && freeSlots?.[day][availIdx];
                              return (
                                <button
                                  key={hour}
                                  type="button"
                                  onClick={() => setAddDraft({ day, hour })}
                                  aria-label={`Add event, ${day} ${fmtHour(hour)}${busyNames.length > 0 ? `. Busy: ${busyNames.join(", ")}` : ""}`}
                                  style={{ height: ROW_H }}
                                  className={`relative block w-full cursor-pointer border-t border-line-2 transition-colors duration-150 hover:bg-accent/[0.07] ${
                                    isFree ? "bg-data-green/10" : ""
                                  }`}
                                >
                                  {/* half-hour rule */}
                                  <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-1/2 border-t border-dashed border-line-2/70" />
                                  {busyOwnerIds.length > 0 && (
                                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1" aria-hidden>
                                      {busyOwnerIds.map((ownerId) => {
                                        const owner = ownerById.get(ownerId);
                                        if (!owner) return null;
                                        return (
                                          <span
                                            key={ownerId}
                                            className="h-2.5 w-2.5 rounded-full border-2 border-white shadow-[0_1px_2px_rgba(23,32,43,0.18)]"
                                            style={{ background: owner.color }}
                                            title={`${owner.name} is busy`}
                                          />
                                        );
                                      })}
                                    </span>
                                  )}
                                </button>
                              );
                            })}

                            {/* now line */}
                            {i === todayIndex && nowHour != null && (
                              <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: nowHour * ROW_H }}>
                                <span className="-ml-px rounded-pill bg-danger px-1 py-px font-mono text-[9px] font-bold leading-none text-white tabular-nums">
                                  {fmtHour(nowHour)}
                                </span>
                                <span className="h-px flex-1 bg-danger" />
                              </div>
                            )}

                            {/* drag-to-create ghost */}
                            {createGhost && createGhost.day === day && (
                              <div
                                aria-hidden
                                className="pointer-events-none absolute left-0.5 right-0.5 z-10 rounded-[7px] border-[1.5px] border-dashed border-accent bg-accent-soft px-1.5 py-1"
                                style={{ top: createGhost.start * ROW_H, height: Math.max(16, (createGhost.end - createGhost.start) * ROW_H - 2) }}
                              >
                                <span className="font-mono text-[10.5px] font-bold text-accent-strong tabular-nums">
                                  {fmtHour(createGhost.start)} - {fmtHour(createGhost.end)}
                                </span>
                              </div>
                            )}

                            {laid.map(({ event, lane, totalLanes }) => {
                              const ghost = moveGhost?.eventId === event.id ? moveGhost : null;
                              if (ghost && ghost.day !== day) return null; // rendered in its ghost column below
                              const startHour = ghost ? ghost.startHour : event.startHour;
                              const duration = event.endHour - event.startHour;
                              const top = startHour * ROW_H;
                              const height = Math.max(18, duration * ROW_H - 2);
                              const widthPct = 100 / totalLanes;
                              const feed = feeds.find((f) => f.id === event.feedId);
                              const meta = KIND_META[event.kind];
                              const IconEl = meta.icon;
                              const roomy = height >= 40;
                              const editable = canEditEvent(event);
                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  data-event
                                  onPointerDown={beginMoveDrag(event)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (suppressClickRef.current) {
                                      suppressClickRef.current = false;
                                      return;
                                    }
                                    setSelectedEvent(event);
                                  }}
                                  title={event.title}
                                  style={{
                                    top,
                                    height,
                                    left: ghost ? `${GAP / 2}px` : `calc(${lane * widthPct}% + ${GAP / 2}px)`,
                                    width: ghost ? `calc(100% - ${GAP}px)` : `calc(${widthPct}% - ${GAP}px)`,
                                    ...eventBlockStyle(
                                      event,
                                      feed?.color ?? "#3d6fa6",
                                      event.ownerId === currentUserId,
                                    ),
                                    ...(ghost ? { boxShadow: "0 12px 24px -8px rgba(23,32,43,0.35)", zIndex: 30, opacity: 0.95 } : undefined),
                                  }}
                                  className={`absolute overflow-hidden rounded-[7px] px-1.5 py-1 text-left text-[11.5px] font-semibold leading-tight transition-shadow duration-150 hover:shadow-[0_3px_10px_rgba(23,32,43,0.22)] ${
                                    editable && !event.allDay ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                                  }`}
                                >
                                  <span className="flex items-center gap-1">
                                    <IconEl
                                      size={10}
                                      weight="bold"
                                      className="shrink-0"
                                      style={{
                                        color:
                                          event.kind === "busy" && event.ownerId !== currentUserId
                                            ? "var(--ink-3)"
                                            : feed?.color ?? "#3d6fa6",
                                      }}
                                    />
                                    <span className="truncate">{event.title}</span>
                                  </span>
                                  {roomy && (
                                    <span className="mt-0.5 block font-mono text-[9.5px] font-semibold tabular-nums opacity-70">
                                      {fmtHour(startHour)} - {fmtHour(startHour + duration)}
                                    </span>
                                  )}
                                </button>
                              );
                            })}

                            {/* an event mid-move hovering over THIS column, coming from another day */}
                            {moveGhost && moveGhost.day === day &&
                              (() => {
                                const source = shownEvents.find((e) => e.id === moveGhost.eventId);
                                if (!source || source.day === day) return null;
                                const duration = source.endHour - source.startHour;
                                const feed = feeds.find((f) => f.id === source.feedId);
                                return (
                                  <div
                                    aria-hidden
                                    className="pointer-events-none absolute left-0.5 right-0.5 z-30 overflow-hidden rounded-[7px] px-1.5 py-1 text-[11.5px] font-semibold leading-tight"
                                    style={{
                                      top: moveGhost.startHour * ROW_H,
                                      height: Math.max(18, duration * ROW_H - 2),
                                      ...eventBlockStyle(
                                        source,
                                        feed?.color ?? "#3d6fa6",
                                        source.ownerId === currentUserId,
                                      ),
                                      boxShadow: "0 12px 24px -8px rgba(23,32,43,0.35)",
                                      opacity: 0.95,
                                    }}
                                  >
                                    <span className="block truncate">{source.title}</span>
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {shownEvents.length === 0 && (
                    <p className="border-t border-line-2 py-3 text-center text-[13px] text-ink-2">
                      Nothing on the calendar this week yet — drag on the grid to add an event, or connect a feed for it to sync in.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          feed={feeds.find((f) => f.id === selectedEvent.feedId)}
          customers={customers}
          canEdit={canEditEvent(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          onDelete={() => deleteEvent(selectedEvent.id)}
        />
      )}
      {addDraft && <AddEventForm draft={addDraft} feeds={myFeeds} customers={customers} currentUserId={currentUserId} onSave={addEvent} onClose={() => setAddDraft(null)} />}
    </>
  );
}
