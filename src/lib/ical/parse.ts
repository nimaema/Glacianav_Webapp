// ICS (iCalendar) parser for calendar feed synchronization
// Handles VEVENT components, RRULE recurrence, and proper timezone handling

import { DateTime } from "luxon";
import { resolveIanaZone } from "./windows-timezones";

export interface IcsEvent {
  uid: string; // ICS UID for idempotent sync
  summary: string; // Event title
  description?: string;
  start: Date; // Parsed DTSTART
  end: Date; // Parsed DTEND
  allDay: boolean;
  location?: string;
  rrule?: string; // RRULE string for recurring events
  recurrenceId?: string; // For recurrence exceptions
  status?: string; // CONFIRMED, TENTATIVE, CANCELLED
  sequence?: number; // For versioning
  lastModified?: Date;
  created?: Date;
}

export interface IcsCalendar {
  events: IcsEvent[];
  name?: string; // X-WR-CALNAME
  description?: string;
  timezone?: string; // X-WR-TIMEZONE
  etag?: string; // HTTP ETag for conditional sync
}

/**
 * Extract the TZID parameter from an ICS property's key part.
 * e.g. `DTSTART;TZID=FLE Standard Time` -> "FLE Standard Time".
 * Handles both quoted (`TZID="..."`) and bare values, and TZID appearing
 * alongside other parameters.
 */
function extractTzid(keyPart: string): string | undefined {
  const match = keyPart.match(/TZID=(?:"([^"]+)"|([^;:]+))/i);
  return match ? (match[1] || match[2]).trim() : undefined;
}

/**
 * Parse ICS date/time string into a correct UTC instant.
 * Supports: YYYYMMDD, YYYYMMDDTHHMMSSZ, YYYYMMDDTHHMMSS
 * Also handles parameterized formats like DTSTART;VALUE=DATE:YYYYMMDD
 *
 * Timezone resolution for timed values, in priority order:
 *   1. `Z` suffix -> UTC.
 *   2. `tzid` (from the property's TZID param) -> resolved via the Windows/IANA
 *      map. Microsoft feeds use Windows names like "FLE Standard Time".
 *   3. `fallbackZone` (the calendar's X-WR-TIMEZONE) for floating times.
 *   4. UTC as a last resort so results are deterministic regardless of the
 *      server's local timezone (the previous behaviour silently used the
 *      server TZ, shifting every event by the server<->calendar offset).
 *
 * Note: For all-day events, DTEND is the exclusive end (first day NOT in the
 * event). Some feeds incorrectly use the same value for DTSTART and DTEND; the
 * sync service normalizes those zero-duration events to one day.
 */
function parseIcsDate(
  dateStr: string,
  isAllDay: boolean,
  tzid?: string,
  fallbackZone?: string,
): Date {
  if (!dateStr) return new Date();

  // Remove parameters (e.g., TZID=America/New_York, VALUE=DATE)
  const clean = dateStr.split(':').pop() || dateStr;

  const year = parseInt(clean.slice(0, 4));
  const month = parseInt(clean.slice(4, 6)) - 1;
  const day = parseInt(clean.slice(6, 8));

  const hasTime = clean.includes('T');
  if (isAllDay || !hasTime || clean.length === 8) {
    // Date-only / all-day: anchor at UTC midnight so the calendar date is
    // stable regardless of server timezone.
    return new Date(Date.UTC(year, month, day, 0, 0, 0));
  }

  const hours = parseInt(clean.slice(9, 11));
  const minutes = parseInt(clean.slice(11, 13));
  const seconds = parseInt(clean.slice(13, 15)) || 0;

  // 1. Explicit UTC.
  if (clean.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // 2/3. Named zone from the TZID param, else the calendar's default zone.
  const zone = resolveIanaZone(tzid) || resolveIanaZone(fallbackZone);
  if (zone) {
    const dt = DateTime.fromObject(
      { year, month: month + 1, day, hour: hours, minute: minutes, second: seconds },
      { zone },
    );
    if (dt.isValid) return dt.toJSDate();
  }

  // 4. Deterministic fallback: treat the wall-clock time as UTC.
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

/**
 * Parse ICS duration string (e.g., "P1D", "PT2H30M")
 * Returns duration in milliseconds
 */
function parseDuration(durationStr: string): number {
  const match = durationStr.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!match) return 0;

  let ms = 0;
  if (match[1]) ms += parseInt(match[1]) * 24 * 60 * 60 * 1000; // Days
  if (match[2]) ms += parseInt(match[2]) * 60 * 60 * 1000; // Hours
  if (match[3]) ms += parseInt(match[3]) * 60 * 1000; // Minutes

  return ms;
}

/**
 * Parse RRULE string
 * Supports: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, COUNT=, INTERVAL=, BYDAY=, BYMONTHDAY=
 */
export interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  count?: number;
  interval?: number;
  byDay?: string[]; // MO, TU, WE, TH, FR, SA, SU
  byMonthDay?: number[];
  until?: Date;
}

function parseRRule(rruleStr: string): RRule | null {
  const parts: Record<string, string> = {};
  rruleStr.split(';').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });

  if (!parts.FREQ) return null;

  const rrule: RRule = {
    freq: parts.FREQ as RRule['freq'],
    interval: parts.INTERVAL ? parseInt(parts.INTERVAL) : 1,
  };

  if (parts.COUNT) rrule.count = parseInt(parts.COUNT);
  if (parts.BYDAY) rrule.byDay = parts.BYDAY.split(',');
  if (parts.BYMONTHDAY) {
    rrule.byMonthDay = parts.BYMONTHDAY.split(',').map((d) => parseInt(d));
  }
  if (parts.UNTIL) rrule.until = parseIcsDate(parts.UNTIL, false);

  return rrule;
}

/**
 * Expand recurring events within a time window
 */
function expandRecurringEvent(
  event: IcsEvent,
  windowStart: Date,
  windowEnd: Date
): IcsEvent[] {
  if (!event.rrule) return [event];

  const rrule = parseRRule(event.rrule);
  if (!rrule) return [event];

  const occurrences: IcsEvent[] = [];
  const duration = event.end.getTime() - event.start.getTime();
  const current = new Date(event.start);
  let count = 0;

  const maxOccurrences = rrule.count || 365; // Limit to prevent infinite loops
  const maxIterations = maxOccurrences * (rrule.interval || 1) * 50; // Safety limit

  for (let i = 0; i < maxIterations && count < maxOccurrences; i++) {
    // Check if we've exceeded the window
    if (current > windowEnd && (!rrule.until || current > rrule.until)) break;

    // Add occurrence if it falls within the window
    const occurrenceEnd = new Date(current.getTime() + duration);
    if (current <= windowEnd && occurrenceEnd >= windowStart) {
      occurrences.push({
        ...event,
        start: new Date(current),
        end: occurrenceEnd,
        uid: `${event.uid}_${current.toISOString().split('T')[0]}`, // Unique ID per occurrence
        recurrenceId: event.uid,
      });
      count++;
    }

    // Advance to next occurrence
    switch (rrule.freq) {
      case 'DAILY':
        current.setDate(current.getDate() + (rrule.interval || 1));
        break;
      case 'WEEKLY':
        if (rrule.byDay && rrule.byDay.length > 0) {
          // Find next matching day
          const dayMap: Record<string, number> = {
            SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
          };
          const currentDay = current.getDay();
          const targetDays = rrule.byDay.map((d) => dayMap[d] ?? 0).sort((a, b) => a - b);

          // Find next matching day
          let nextDay: number | null = null;
          for (const day of targetDays) {
            if (day > currentDay) {
              nextDay = day;
              break;
            }
          }

          if (nextDay !== null) {
            current.setDate(current.getDate() + (nextDay - currentDay));
          } else {
            // Next week
            current.setDate(current.getDate() + (7 - currentDay + targetDays[0]));
          }
        } else {
          current.setDate(current.getDate() + 7 * (rrule.interval || 1));
        }
        break;
      case 'MONTHLY':
        current.setMonth(current.getMonth() + (rrule.interval || 1));
        if (rrule.byMonthDay && rrule.byMonthDay.length > 0) {
          const targetDay = rrule.byMonthDay[0];
          const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
          current.setDate(Math.min(targetDay, lastDay));
        }
        break;
      case 'YEARLY':
        current.setFullYear(current.getFullYear() + (rrule.interval || 1));
        break;
    }

    // Check UNTIL
    if (rrule.until && current > rrule.until) break;
  }

  return occurrences;
}

/**
 * Parse ICS content string
 */
export function parseIcs(icsContent: string): IcsCalendar {
  const rawLines = icsContent.split(/\r\n|\n|\r/);

  // RFC 5545 line unfolding: a line broken across multiple physical lines is
  // continued by a leading space or tab. Rejoin these into logical lines
  // before parsing — otherwise long folded values (Google folds at 75 octets)
  // get truncated, and a folded UID could make a valid event silently drop.
  const lines: string[] = [];
  for (const raw of rawLines) {
    if (lines.length > 0 && (raw.startsWith(' ') || raw.startsWith('\t'))) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }

  const calendar: IcsCalendar = { events: [] };
  let currentEvent: Partial<IcsEvent> | null = null;
  let inEvent = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line || line.trim() === '') continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const keyPart = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);

    // Extract key from parameters (e.g., "DTSTART;VALUE=DATE" -> "DTSTART")
    const key = keyPart.split(';')[0].trim().toUpperCase();
    switch (key) {
      case 'BEGIN':
        if (value === 'VCALENDAR') {
          // Calendar start - nothing special needed
        } else if (value === 'VEVENT') {
          inEvent = true;
          currentEvent = {};
        }
        break;
      case 'END':
        if (value === 'VCALENDAR') {
          // Calendar end
        } else if (value === 'VEVENT') {
          if (currentEvent && currentEvent.uid) {
            // Untitled events are valid in ICS (Google exports them without a
            // SUMMARY). Give them a placeholder title so downstream storage
            // with a NOT NULL title column doesn't reject them.
            if (!currentEvent.summary || !currentEvent.summary.trim()) {
              currentEvent.summary = '(No title)';
            }
            calendar.events.push(currentEvent as IcsEvent);
          }
          inEvent = false;
          currentEvent = null;
        }
        break;
      case 'X-WR-CALNAME':
        calendar.name = value;
        break;
      case 'X-WR-TIMEZONE':
        calendar.timezone = value;
        break;
      case 'UID':
        if (inEvent && currentEvent) currentEvent.uid = value;
        break;
      case 'SUMMARY':
        if (inEvent && currentEvent) currentEvent.summary = value;
        break;
      case 'DESCRIPTION':
        if (inEvent && currentEvent) currentEvent.description = value;
        break;
      case 'LOCATION':
        if (inEvent && currentEvent) currentEvent.location = value;
        break;
      case 'DTSTART':
        if (inEvent && currentEvent) {
          // Check if VALUE=DATE parameter is present for all-day events
          const isAllDay = keyPart.includes('VALUE=DATE') || !value.includes('T');
          currentEvent.start = parseIcsDate(value, isAllDay, extractTzid(keyPart), calendar.timezone);
          currentEvent.allDay = isAllDay;
        }
        break;
      case 'DTEND':
        if (inEvent && currentEvent) {
          // Check if VALUE=DATE parameter is present for all-day events
          const isAllDay = keyPart.includes('VALUE=DATE') || !value.includes('T');
          currentEvent.end = parseIcsDate(value, isAllDay, extractTzid(keyPart), calendar.timezone);
        }
        break;
      case 'DURATION':
        if (inEvent && currentEvent && currentEvent.start) {
          const duration = parseDuration(value);
          currentEvent.end = new Date(currentEvent.start.getTime() + duration);
        }
        break;
      case 'RRULE':
        if (inEvent && currentEvent) currentEvent.rrule = value;
        break;
      case 'STATUS':
        if (inEvent && currentEvent) currentEvent.status = value;
        break;
      case 'SEQUENCE':
        if (inEvent && currentEvent) currentEvent.sequence = parseInt(value);
        break;
      case 'LAST-MODIFIED':
        if (inEvent && currentEvent) currentEvent.lastModified = parseIcsDate(value, false);
        break;
      case 'CREATED':
        if (inEvent && currentEvent) currentEvent.created = parseIcsDate(value, false);
        break;
    }
  }

  return calendar;
}

/**
 * Fetch and parse ICS feed from URL
 */
export async function fetchIcsFeed(url: string): Promise<{ calendar: IcsCalendar; etag?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    // Validate URL format
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL format: ${url}. Make sure it starts with http:// or https://`);
    }

    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${validUrl.protocol}. Only http:// and https:// are supported.`);
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GlaciaNav-Calendar-Sync/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication required (${response.status}). This calendar may be private. Use a public calendar URL instead.`);
      }
      if (response.status === 404) {
        throw new Error(`Calendar not found (${response.status}). Check that the URL is correct.`);
      }
      if (response.status >= 500) {
        throw new Error(
          `Calendar publisher error (${response.status}: ${response.statusText || 'server error'}). ` +
          'The published link may be expired or temporarily unavailable.',
        );
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/calendar') && !contentType.includes('ics')) {
      console.warn(`[ICS Fetch] Unexpected content type: ${contentType}. The URL may not return ICS format.`);
    }

    const etag = response.headers.get('ETag') || undefined;
    const content = await response.text();

    // Check if content looks like ICS
    if (!content.includes('BEGIN:VCALENDAR') || !content.includes('END:VCALENDAR')) {
      throw new Error(`Invalid ICS format. The URL may not be a calendar feed. Expected content starting with "BEGIN:VCALENDAR".`);
    }

    const calendar = parseIcs(content);

    return { calendar, etag };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - feed took too long to respond (30s limit)');
      }
      throw error;
    }
    throw new Error('Failed to fetch calendar feed');
  }
}

/**
 * Expand recurring events within a time window (90 days past and future)
 */
export function expandCalendarEvents(
  calendar: IcsCalendar,
  windowStart: Date = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
  windowEnd: Date = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
): IcsEvent[] {
  const allEvents: IcsEvent[] = [];

  for (const event of calendar.events) {
    // Skip cancelled events
    if (event.status === 'CANCELLED') continue;

    const occurrences = expandRecurringEvent(event, windowStart, windowEnd);
    allEvents.push(...occurrences);
  }

  return allEvents;
}
