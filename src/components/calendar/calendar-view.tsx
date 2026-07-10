"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
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
import {
  CALENDAR_DAYS,
  CALENDAR_HOURS,
  type CalendarDay,
  type CalendarEvent,
  type CalendarEventKind,
  type CalendarFeed,
  type Customer,
} from "@/lib/fixtures";
import type { CalendarPageData, RealCalendarEvent, RealCalendarFeed } from "@/lib/data/calendar";
import { addCalendarEvent, addCalendarFeed, deleteCalendarEvent, removeCalendarFeed } from "@/lib/data/calendar-actions";

const ROW_H = 56; // px per hour row, shared by grid rows, event blocks, and the now-line
const GAP = 2; // px gutter between side-by-side overlapping events

const KIND_META: Record<CalendarEventKind, { label: string; style: string; dot: string; icon: Icon }> = {
  interview: { label: "Interview", style: "border-data-cyan bg-data-cyan/20 text-ink", dot: "bg-data-cyan", icon: CalendarCheck },
  recording: { label: "Recording", style: "border-[#6e5be8] bg-[rgba(110,91,232,0.16)] text-ink", dot: "bg-[#6e5be8]", icon: Microphone },
  busy: { label: "Busy", style: "border-transparent bg-[#d4e4ea] text-ink-2", dot: "bg-[#9cb8c1]", icon: CircleDashed },
  hold: { label: "Hold", style: "border-dashed border-melt/55 bg-transparent text-melt", dot: "bg-melt", icon: BookmarkSimple },
};

// Monday of the week containing `d`.
function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric" });
}

function fmtRange(monday: Date) {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const sameMonth = monday.getMonth() === friday.getMonth();
  const startFmt = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endFmt = friday.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${startFmt} - ${endFmt}, ${friday.getFullYear()}`;
}

function fmtHour(h: number) {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return min === 0 ? `${h12}:00 ${period}` : `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

function syncLabel(f: CalendarFeed) {
  if (f.internal) return "Live";
  if (f.syncStatus === "error") return "Sync failed";
  if (f.syncStatus === "syncing") return "Syncing…";
  const m = f.lastSyncedMinutes ?? 0;
  return m < 60 ? `Synced ${m}m ago` : `Synced ${Math.round(m / 60)}h ago`;
}

function syncDotColor(f: CalendarFeed) {
  if (f.internal) return "#27b577";
  if (f.syncStatus === "error") return "#cf5040";
  if (f.syncStatus === "syncing") return "#d9b23c";
  return "#27b577";
}

// Simple greedy lane packing so overlapping events sit side by side instead
// of stacking on top of one another.
function layoutDay(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);
  const laneEnds: number[] = [];
  const placed: { event: CalendarEvent; lane: number }[] = [];
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
function bestWindows(freeSlots: Record<CalendarDay, boolean[]> | null, maxCount = 3) {
  if (!freeSlots) return [];
  const windows: { day: CalendarDay; startHour: number; endHour: number; length: number }[] = [];
  for (const day of CALENDAR_DAYS) {
    let runStart: number | null = null;
    for (let i = 0; i <= CALENDAR_HOURS.length; i++) {
      const free = i < CALENDAR_HOURS.length && freeSlots[day][i];
      if (free && runStart === null) runStart = i;
      if (!free && runStart !== null) {
        windows.push({ day, startHour: CALENDAR_HOURS[runStart], endHour: CALENDAR_HOURS[i - 1] + 1, length: i - runStart });
        runStart = null;
      }
    }
  }
  return windows.sort((a, b) => b.length - a.length).slice(0, maxCount);
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
      className="anim-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,46,56,0.55)] px-4"
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
  onClose,
  onDelete,
}: {
  event: CalendarEvent;
  feed?: CalendarFeed;
  customers: Customer[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[event.kind];
  const customer = event.customerId ? customers.find((c) => c.id === event.customerId) : undefined;
  return (
    <Modal title={event.title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-bold ${meta.style}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
          {meta.label}
        </span>
        <div className="flex items-center gap-2 text-[14px] text-ink-2">
          <CalendarBlank size={15} className="shrink-0 text-ink-3" />
          {event.day}, {event.allDay ? "All day" : `${fmtHour(event.startHour)} - ${fmtHour(event.endHour)}`}
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
            className="recessed flex items-center justify-between px-3 py-2.5 text-[13.5px] font-semibold text-melt transition-colors duration-150 hover:bg-[rgba(11,61,77,0.10)]"
          >
            Open {customer.name}
            <CaretRight size={13} />
          </Link>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDelete}
          className="h-9 cursor-pointer rounded-md px-3.5 text-[14px] font-bold text-[#b23c2e] transition-colors duration-150 hover:bg-[rgba(207,80,64,0.10)]"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
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
  draft: { day: CalendarDay; hour: number };
  feeds: CalendarFeed[];
  customers: Customer[];
  currentUserId: string;
  onSave: (event: Omit<CalendarEvent, "id">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CalendarEventKind>("hold");
  const [day, setDay] = useState<CalendarDay>(draft.day);
  const [start, setStart] = useState(draft.hour);
  const [end, setEnd] = useState(Math.min(draft.hour + 1, CALENDAR_HOURS[CALENDAR_HOURS.length - 1] + 1));
  const [allDay, setAllDay] = useState(false);
  const [feedId, setFeedId] = useState(feeds.find((f) => f.internal)?.id ?? feeds[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");

  const save = () => {
    const t = title.trim();
    if (!t || (!allDay && end <= start)) return;
    const feed = feeds.find((f) => f.id === feedId);
    onSave({
      feedId,
      ownerId: feed?.ownerId ?? currentUserId,
      day,
      startHour: allDay ? CALENDAR_HOURS[0] : start,
      endHour: allDay ? CALENDAR_HOURS[CALENDAR_HOURS.length - 1] + 1 : end,
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
          <select value={day} onChange={(e) => setDay(e.target.value as CalendarDay)} aria-label="Day" className="recessed h-9 flex-1 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none">
            {CALENDAR_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-2">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-3.5 w-3.5 cursor-pointer accent-[#0295ac]" />
          All day
        </label>
        {!allDay && (
          <div className="flex gap-2">
            <select
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              aria-label="Start time"
              className="recessed h-9 flex-1 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none"
            >
              {CALENDAR_HOURS.map((h) => (
                <option key={h} value={h}>
                  {fmtHour(h)}
                </option>
              ))}
            </select>
            <select
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
              aria-label="End time"
              className="recessed h-9 flex-1 cursor-pointer px-2.5 text-[13.5px] text-ink outline-none"
            >
              {[...CALENDAR_HOURS, CALENDAR_HOURS[CALENDAR_HOURS.length - 1] + 1].map((h) => (
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
        <button type="button" onClick={save} className="h-9 cursor-pointer rounded-md bg-melt px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong">
          Add event
        </button>
      </div>
    </Modal>
  );
}

function MiniMonth({
  anchor,
  weekStart,
  todayKey,
  onPick,
}: {
  anchor: Date;
  weekStart: Date;
  todayKey: string | null;
  onPick: (d: Date) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="surfaced px-3.5 py-3">
      <div className="mb-2 text-center text-[13px] font-bold text-ink">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center text-[10.5px] font-bold text-ink-3">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const key = d.toDateString();
          const isToday = todayKey === key;
          const inWeek = d >= weekStart && d <= weekEnd;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(d)}
              className={`mx-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-full font-mono text-[11.5px] tabular-nums transition-colors duration-150 ${
                isToday
                  ? "bg-melt font-bold text-white"
                  : inWeek
                    ? "bg-melt/15 font-semibold text-ink"
                    : inMonth
                      ? "text-ink-2 hover:bg-surface-2"
                      : "text-ink-3/40 hover:bg-surface-2"
              }`}
            >
              {d.getDate()}
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
  weekDates: { day: CalendarDay; date: Date }[];
  todayIndex: number;
  events: CalendarEvent[];
  feeds: CalendarFeed[];
  customers: Customer[];
  onSelect: (e: CalendarEvent) => void;
}) {
  return (
    <div className="surfaced flex flex-col gap-6 p-5">
      {weekDates.map(({ day, date }, i) => {
        const dayEvents = events
          .filter((e) => e.day === day)
          .sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || a.startHour - b.startHour);
        return (
          <div key={day}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12.5px] font-bold tabular-nums ${
                  i === todayIndex ? "bg-melt text-white" : "bg-[rgba(11,61,77,0.07)] text-ink-2"
                }`}
              >
                {date.getDate()}
              </span>
              <span className="text-[14px] font-semibold text-ink">
                {date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </span>
              {i === todayIndex && (
                <span className="rounded-full bg-melt/10 px-2 py-0.5 text-[11px] font-bold text-melt">Today</span>
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
                        style={{ background: `${feed?.color ?? "#0295ac"}22`, color: feed?.color ?? "#0295ac" }}
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
                        <span className="truncate text-[12.5px] font-bold text-melt">{customer.name}</span>
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
function toWeekEvent(e: RealCalendarEvent, weekDates: { day: CalendarDay; date: Date }[]): CalendarEvent | null {
  const match = weekDates.find((w) => w.date.toDateString() === e.startAt.toDateString());
  if (!match) return null;
  const startHour = e.allDay ? CALENDAR_HOURS[0] : e.startAt.getHours() + e.startAt.getMinutes() / 60;
  const endHour = e.allDay ? CALENDAR_HOURS[CALENDAR_HOURS.length - 1] + 1 : e.endAt.getHours() + e.endAt.getMinutes() / 60;
  return {
    id: e.id,
    feedId: e.feedId,
    ownerId: e.ownerId,
    day: match.day,
    startHour,
    endHour,
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
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [feeds, setFeeds] = useState<CalendarFeed[]>(() => initialFeeds.map(toFeedShape));
  const [rawEvents, setRawEvents] = useState<RealCalendarEvent[]>(initialEvents);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"week" | "agenda">("week");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [addDraft, setAddDraft] = useState<{ day: CalendarDay; hour: number } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

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

  const monday = useMemo(() => {
    const base = startOfWeek(now ?? new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [now, weekOffset]);

  const weekDates = useMemo(
    () => CALENDAR_DAYS.map((day, i) => ({ day, date: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i) })),
    [monday],
  );

  const todayIndex = useMemo(() => {
    if (!now || weekOffset !== 0) return -1;
    return weekDates.findIndex((w) => w.date.toDateString() === now.toDateString());
  }, [now, weekOffset, weekDates]);

  const myFeeds = feeds.filter((f) => f.ownerId === currentUserId);
  // Bucket each real event (absolute timestamp) into whichever day of the
  // currently-displayed week it actually falls on — genuine week
  // navigation, not the fixture's single repeated template week.
  const weekEvents = useMemo(() => rawEvents.map((e) => toWeekEvent(e, weekDates)).filter((e): e is CalendarEvent => e != null), [rawEvents, weekDates]);
  const shownEvents = weekEvents.filter((e) => visibleFeedIds.has(e.feedId));

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

  const addFeed = () => {
    const url = newFeedUrl.trim();
    if (!url) return;
    setNewFeedUrl("");
    void addCalendarFeed({ ownerId: currentUserId, label: "New calendar", url }).then(({ id }) => {
      const feed: CalendarFeed = { id, ownerId: currentUserId, label: "New calendar", color: "#f26d5f", visibility: "busy_only", syncStatus: "syncing", lastSyncedMinutes: 0 };
      setFeeds((fs) => [...fs, feed]);
      setVisibleFeedIds((prev) => new Set(prev).add(id));
    });
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

  const toggleAvailability = (ownerId: string) => {
    setAvailabilityWith((prev) => {
      const next = new Set(prev);
      if (next.has(ownerId)) next.delete(ownerId);
      else next.add(ownerId);
      return next;
    });
  };

  // A slot counts as "free for the group" when none of the selected
  // teammates (or me) has a busy/interview/recording event covering it.
  const freeSlots = useMemo(() => {
    if (availabilityWith.size === 0) return null;
    const people = [currentUserId, ...availabilityWith];
    const busyByPerson = people.map((id) => weekEvents.filter((e) => e.ownerId === id && !e.allDay));
    const result: Record<CalendarDay, boolean[]> = {} as Record<CalendarDay, boolean[]>;
    for (const day of CALENDAR_DAYS) {
      result[day] = CALENDAR_HOURS.map((hour) =>
        busyByPerson.every((evs) => !evs.some((e) => e.day === day && hour >= e.startHour && hour < e.endHour)),
      );
    }
    return result;
  }, [availabilityWith, weekEvents, currentUserId]);

  const suggestedSlots = useMemo(() => bestWindows(freeSlots), [freeSlots]);

  const addEvent = (draft: Omit<CalendarEvent, "id">) => {
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

  const nowTop = now && (now.getHours() + now.getMinutes() / 60 - CALENDAR_HOURS[0]) * ROW_H;
  const todaysMeetings =
    todayIndex >= 0 ? shownEvents.filter((e) => e.day === weekDates[todayIndex].day && !e.allDay).length : 0;

  return (
    <>
      <PageHeader
        title="Calendar"
        icon={CalendarBlank}
        meta="Every feed you subscribe to, layered into one week, plus who else is free."
        actions={
          <>
            <HeaderStat label="Today" value={todaysMeetings} />
            <HeaderStat label="Interviews this week" value={shownEvents.filter((e) => e.kind === "interview").length} divider />
            <HeaderStat label="Feeds shown" value={visibleFeedIds.size} divider />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1600px] gap-6 px-7 py-6">
        <aside className="flex w-[264px] shrink-0 flex-col gap-6">
          <MiniMonth anchor={monday} weekStart={monday} todayKey={now ? now.toDateString() : null} onPick={jumpToDate} />

          <section className="flex flex-col gap-2.5">
            <SectionHeader>My feeds</SectionHeader>
            <div className="surfaced flex flex-col gap-1 px-3 py-2.5">
              {myFeeds.map((f) => (
                <div key={f.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors duration-150 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={visibleFeedIds.has(f.id)}
                    onChange={() => toggleFeed(f.id)}
                    aria-label={`Toggle ${f.label}`}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#0295ac]"
                  />
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{f.label}</div>
                    <div className="flex items-center gap-1 text-[11px] text-ink-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: syncDotColor(f) }} aria-hidden />
                      {syncLabel(f)}
                    </div>
                  </div>
                  {f.internal ? (
                    <span className="shrink-0 text-[11px] font-semibold text-ink-3">internal</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeFeed(f.id)}
                      aria-label={`Remove ${f.label}`}
                      className="shrink-0 cursor-pointer text-ink-3 opacity-0 transition-opacity duration-150 hover:text-[#b23c2e] group-hover:opacity-100"
                    >
                      <Trash size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="recessed flex items-center gap-1.5 px-2.5 py-2">
              <LinkIcon size={14} className="shrink-0 text-ink-3" />
              <input
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFeed()}
                placeholder="Paste an ICS link…"
                aria-label="New calendar feed URL"
                className="h-6 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                onClick={addFeed}
                aria-label="Add feed"
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-melt hover:bg-melt/10"
              >
                <Plus size={14} weight="bold" />
              </button>
            </div>
            <p className="px-1 text-[12px] leading-snug text-ink-3">
              Works with any Outlook, Google, or Apple published calendar link. Busy-only by
              default. Teammates only ever see free/busy, never titles or details.
            </p>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeader>Kind</SectionHeader>
            <div className="surfaced flex flex-wrap gap-x-3 gap-y-1.5 px-3.5 py-3">
              {(Object.keys(KIND_META) as CalendarEventKind[]).map((k) => (
                <div key={k} className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${KIND_META[k].dot}`} aria-hidden />
                  {KIND_META[k].label}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeader icon={<UsersThree size={14} />}>Find a slot</SectionHeader>
            <div className="surfaced flex flex-col gap-1.5 px-3 py-2.5">
              {owners
                .filter((o) => o.id !== currentUserId)
                .map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={availabilityWith.has(o.id)}
                      onChange={() => toggleAvailability(o.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#0295ac]"
                    />
                    <Avatar owner={o} size={20} />
                    <span>{o.name}</span>
                  </label>
                ))}
            </div>
            {freeSlots && (
              <>
                <p className="recessed px-3 py-2.5 text-[12.5px] leading-snug text-ink-2">
                  Green columns below mark hours everyone selected is free. Busy-only feeds still
                  count even though you can&apos;t see what&apos;s on them.
                </p>
                {suggestedSlots.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">Best windows</span>
                    {suggestedSlots.map((w, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAddDraft({ day: w.day, hour: w.startHour })}
                        className="surfaced rise-on-hover flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-semibold text-ink"
                      >
                        <span>
                          {w.day}, {fmtHour(w.startHour)} - {fmtHour(w.endHour)}
                        </span>
                        <Plus size={13} className="shrink-0 text-melt" weight="bold" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="surfaced mb-4 flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Previous week"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                <CaretLeft size={15} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Next week"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
              >
                <CaretRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="recessed h-8 cursor-pointer px-3 text-[13px] font-bold text-ink-2 transition-colors duration-150 hover:text-ink"
              >
                Today
              </button>
              <span className="ml-2 text-[15.5px] font-semibold text-ink">{fmtRange(monday)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div role="tablist" aria-label="View" className="recessed flex gap-0.5 p-1">
                {([
                  { id: "week", label: "Week", icon: SquaresFour },
                  { id: "agenda", label: "Agenda", icon: ListBullets },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={view === v.id}
                    onClick={() => setView(v.id)}
                    className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors duration-150 ${
                      view === v.id ? "surfaced text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <v.icon size={13} />
                    {v.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAddDraft({ day: weekDates[todayIndex >= 0 ? todayIndex : 0].day, hour: CALENDAR_HOURS[0] })}
                className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-melt px-3 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
              >
                <Plus size={14} weight="bold" />
                New event
              </button>
            </div>
          </div>

          {view === "agenda" ? (
            <AgendaView weekDates={weekDates} todayIndex={todayIndex} events={shownEvents} feeds={feeds} customers={customers} onSelect={setSelectedEvent} />
          ) : (
            <div className="overflow-x-auto">
              <div className="surfaced min-w-[820px] p-5">
                <div className="grid" style={{ gridTemplateColumns: `54px repeat(${CALENDAR_DAYS.length}, minmax(0, 1fr))` }}>
                  <div />
                  {weekDates.map(({ day, date }, i) => (
                    <div key={day} className="pb-3 text-center">
                      <div className={`text-[13px] font-bold uppercase tracking-[0.08em] ${i === todayIndex ? "text-melt" : "text-ink-2"}`}>{day}</div>
                      <div
                        className={`mx-auto mt-1.5 flex h-7 w-7 items-center justify-center rounded-full font-mono text-[13px] font-bold tabular-nums ${
                          i === todayIndex ? "bg-melt text-white" : "text-ink-3"
                        }`}
                      >
                        {fmtDay(date)}
                      </div>
                    </div>
                  ))}

                  <div />
                  {weekDates.map(({ day }) => {
                    const allDayEvents = shownEvents.filter((e) => e.day === day && e.allDay);
                    return (
                      <div key={`allday-${day}`} className="flex flex-col gap-1 border-l border-line-2 px-1 pb-2">
                        {allDayEvents.map((e) => {
                          const feed = feeds.find((f) => f.id === e.feedId);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => setSelectedEvent(e)}
                              title={e.title}
                              className="cursor-pointer truncate rounded px-1.5 py-1 text-left text-[11px] font-bold transition-shadow duration-150 hover:shadow-[0_2px_6px_rgba(11,61,77,0.2)]"
                              style={{ background: `${feed?.color ?? "#0295ac"}22`, color: feed?.color ?? "#0295ac" }}
                            >
                              {e.title}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                  <div className="flex flex-col">
                    {CALENDAR_HOURS.map((h) => (
                      <div key={h} style={{ height: ROW_H }} className="flex items-start justify-end pr-2.5 pt-0.5 font-mono text-[11.5px] text-ink-3">
                        {fmtHour(h)}
                      </div>
                    ))}
                  </div>

                  {weekDates.map(({ day }, i) => {
                    const dayEvents = shownEvents.filter((e) => e.day === day && !e.allDay);
                    const laid = layoutDay(dayEvents);
                    return (
                      <div key={day} className={`relative border-l border-line-2 ${i === todayIndex ? "bg-melt/[0.05]" : ""}`}>
                        {CALENDAR_HOURS.map((h, hi) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setAddDraft({ day, hour: h })}
                            aria-label={`Add event, ${day} ${fmtHour(h)}`}
                            style={{ height: ROW_H }}
                            className={`block w-full cursor-pointer border-t border-line-2 transition-colors duration-150 hover:bg-melt/[0.08] ${
                              freeSlots?.[day][CALENDAR_HOURS.indexOf(h)]
                                ? "bg-[rgba(39,181,119,0.10)]"
                                : hi % 2 === 1
                                  ? "bg-[rgba(11,61,77,0.015)]"
                                  : ""
                            }`}
                          />
                        ))}

                        {i === todayIndex && nowTop != null && nowTop >= 0 && nowTop <= CALENDAR_HOURS.length * ROW_H && (
                          <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center gap-1" style={{ top: nowTop }}>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#cf5040]" />
                            <span className="h-px flex-1 bg-[#cf5040]" />
                          </div>
                        )}

                        {laid.map(({ event, lane, totalLanes }) => {
                          const top = (event.startHour - CALENDAR_HOURS[0]) * ROW_H;
                          const height = Math.max(18, (event.endHour - event.startHour) * ROW_H - 2);
                          const widthPct = 100 / totalLanes;
                          const feed = feeds.find((f) => f.id === event.feedId);
                          const meta = KIND_META[event.kind];
                          const IconEl = meta.icon;
                          const roomy = height >= 40;
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                              }}
                              title={event.title}
                              style={{
                                top,
                                height,
                                left: `calc(${lane * widthPct}% + ${GAP / 2}px)`,
                                width: `calc(${widthPct}% - ${GAP}px)`,
                                borderLeftColor: feed?.color ?? "#0295ac",
                                borderLeftWidth: 3,
                              }}
                              className={`absolute cursor-pointer overflow-hidden rounded border px-1.5 py-1 text-left text-[11.5px] font-semibold leading-tight transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(11,61,77,0.25)] ${meta.style}`}
                            >
                              <span className="flex items-center gap-1">
                                <IconEl size={10} weight="bold" className="shrink-0" />
                                <span className="truncate">{event.title}</span>
                              </span>
                              {roomy && (
                                <span className="mt-0.5 block text-[10px] font-normal opacity-75">
                                  {fmtHour(event.startHour)} - {fmtHour(event.endHour)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {shownEvents.length === 0 && (
                  <p className="mt-3 text-center text-[13px] text-ink-2">
                    Nothing on the calendar this week yet. Add an event, or connect a feed for it to sync in.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          feed={feeds.find((f) => f.id === selectedEvent.feedId)}
          customers={customers}
          onClose={() => setSelectedEvent(null)}
          onDelete={() => deleteEvent(selectedEvent.id)}
        />
      )}
      {addDraft && <AddEventForm draft={addDraft} feeds={myFeeds} customers={customers} currentUserId={currentUserId} onSave={addEvent} onClose={() => setAddDraft(null)} />}
    </>
  );
}
