"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarBlank, Link as LinkIcon, Plus, Trash, UsersThree } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import {
  CALENDAR_DAYS,
  CALENDAR_HOURS,
  calendarEvents,
  calendarFeeds,
  owners,
  type CalendarDay,
  type CalendarEvent,
  type CalendarFeed,
} from "@/lib/fixtures";

const CURRENT_USER = "nima";
const ROW_H = 34; // px per hour row, shared by grid rows and event blocks

const KIND_STYLE: Record<CalendarEvent["kind"], string> = {
  interview: "border-data-cyan bg-data-cyan/20 text-ink",
  recording: "border-[#6e5be8] bg-[rgba(110,91,232,0.16)] text-ink",
  busy: "border-transparent bg-[#d4e4ea] text-ink-2",
  hold: "border-dashed border-melt/55 bg-transparent text-melt",
};

function EventBlock({ event, color }: { event: CalendarEvent; color: string }) {
  const top = (event.startHour - CALENDAR_HOURS[0]) * ROW_H;
  const height = Math.max(18, (event.endHour - event.startHour) * ROW_H - 2);
  const body = (
    <div
      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border px-1.5 py-1 text-[11.5px] font-semibold leading-tight ${KIND_STYLE[event.kind]}`}
      style={{ top, height, borderLeftColor: color, borderLeftWidth: 3 }}
      title={event.title}
    >
      {event.title}
    </div>
  );
  if (event.customerId) {
    return (
      <Link href={`/customers/${event.customerId}`} className="absolute inset-0">
        {body}
      </Link>
    );
  }
  return body;
}

export function CalendarView() {
  const [visibleFeedIds, setVisibleFeedIds] = useState<Set<string>>(
    new Set(calendarFeeds.filter((f) => f.ownerId === CURRENT_USER).map((f) => f.id)),
  );
  const [availabilityWith, setAvailabilityWith] = useState<Set<string>>(new Set());
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [feeds, setFeeds] = useState<CalendarFeed[]>(calendarFeeds);

  const myFeeds = feeds.filter((f) => f.ownerId === CURRENT_USER);
  const visibleEvents = calendarEvents.filter((e) => visibleFeedIds.has(e.feedId));

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
    const id = `f-new-${Date.now()}`;
    const feed: CalendarFeed = {
      id,
      ownerId: CURRENT_USER,
      label: "New calendar",
      color: "#f26d5f",
      visibility: "busy_only",
    };
    setFeeds((fs) => [...fs, feed]);
    setVisibleFeedIds((prev) => new Set(prev).add(id));
    setNewFeedUrl("");
  };

  const removeFeed = (id: string) => {
    setFeeds((fs) => fs.filter((f) => f.id !== id));
    setVisibleFeedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
    const people = [CURRENT_USER, ...availabilityWith];
    if (availabilityWith.size === 0) return null;
    const busyByPerson = people.map((id) => calendarEvents.filter((e) => e.ownerId === id));
    const result: Record<CalendarDay, boolean[]> = {} as Record<CalendarDay, boolean[]>;
    for (const day of CALENDAR_DAYS) {
      result[day] = CALENDAR_HOURS.map((hour) =>
        busyByPerson.every(
          (events) => !events.some((e) => e.day === day && hour >= e.startHour && hour < e.endHour),
        ),
      );
    }
    return result;
  }, [availabilityWith]);

  return (
    <>
      <PageHeader
        title="Calendar"
        icon={CalendarBlank}
        meta="Every feed you subscribe to, layered into one week — plus who else is free."
        actions={
          <>
            <HeaderStat label="Feeds shown" value={visibleFeedIds.size} />
            <HeaderStat label="Interviews this week" value={calendarEvents.filter((e) => e.kind === "interview" && visibleFeedIds.has(e.feedId)).length} divider />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1600px] gap-6 px-7 py-6">
        <aside className="flex w-[260px] shrink-0 flex-col gap-6">
          <section className="flex flex-col gap-2.5">
            <SectionHeader>My feeds</SectionHeader>
            <div className="surfaced flex flex-col gap-1 px-3 py-2.5">
              {myFeeds.map((f) => (
                <label
                  key={f.id}
                  className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={visibleFeedIds.has(f.id)}
                    onChange={() => toggleFeed(f.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[#0295ac]"
                  />
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
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
                </label>
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
              default — teammates only ever see free/busy, never titles or details.
            </p>
          </section>

          <section className="flex flex-col gap-2.5">
            <SectionHeader icon={<UsersThree size={14} />}>Find a slot</SectionHeader>
            <div className="surfaced flex flex-col gap-1.5 px-3 py-2.5">
              {owners
                .filter((o) => o.id !== CURRENT_USER)
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
              <p className="recessed px-3 py-2.5 text-[12.5px] leading-snug text-ink-2">
                Green columns below mark hours everyone selected is free — busy-only feeds still
                count even though you can&apos;t see what&apos;s on them.
              </p>
            )}
          </section>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="surfaced min-w-[640px] p-4">
            <div
              className="grid"
              style={{ gridTemplateColumns: `44px repeat(${CALENDAR_DAYS.length}, minmax(0, 1fr))` }}
            >
              <div />
              {CALENDAR_DAYS.map((day) => (
                <div key={day} className="pb-2 text-center text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">
                  {day}
                </div>
              ))}

              <div className="flex flex-col">
                {CALENDAR_HOURS.map((h) => (
                  <div key={h} style={{ height: ROW_H }} className="pr-2 text-right font-mono text-[11px] text-ink-3">
                    {h}:00
                  </div>
                ))}
              </div>

              {CALENDAR_DAYS.map((day) => (
                <div key={day} className="relative border-l border-line-2">
                  {CALENDAR_HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ height: ROW_H }}
                      className={`border-t border-line-2 ${
                        freeSlots?.[day][CALENDAR_HOURS.indexOf(h)] ? "bg-[rgba(39,181,119,0.10)]" : ""
                      }`}
                    />
                  ))}
                  {visibleEvents
                    .filter((e) => e.day === day)
                    .map((e) => (
                      <EventBlock key={e.id} event={e} color={feeds.find((f) => f.id === e.feedId)?.color ?? "#0295ac"} />
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
