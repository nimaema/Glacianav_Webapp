// Typed fixtures mirroring the future Supabase schema shapes.
// Every screen reads from here until the backend phase lands.

export type Owner = {
  id: string;
  name: string;
  initials: string;
  color: string; // data-palette hex
  email?: string;
  role?: "admin" | "member";
  active?: boolean;
};

export type Segment = {
  id: string;
  name: string;
  color: string;
};

// Shared with ui/pill.tsx, which re-exports this so existing imports of
// PillTone from the component keep working. Lives here, not in the
// component, because Stage (below) is app data that needs the type.
export type PillTone = "cyan" | "green" | "violet" | "coral" | "blue" | "gray";

// A rotation new stages cycle through so "add a stage" never needs a color
// picker — validation-board stages are user content per DESIGN.md §2.
export const STAGE_TONE_ROTATION: PillTone[] = [
  "blue",
  "cyan",
  "green",
  "violet",
  "coral",
  "gray",
];

// The data-palette hex behind each pill tone, for chrome that needs a raw
// color (section-header ticks) rather than the Pill component itself.
export const TONE_HEX: Record<PillTone, string> = {
  blue: "#2f6fd0",
  cyan: "#14b8ce",
  green: "#27b577",
  violet: "#6e5be8",
  coral: "#f26d5f",
  gray: "rgba(11,61,77,0.30)",
};

export type StageKey = string;

export type Stage = { key: StageKey; label: string; tone: PillTone };

export type Priority = "low" | "medium" | "high";

export type ContactChannel = "email" | "linkedin" | "phone";

// A customer/account is either a whole company (a contact is assigned to
// represent it) or a single independent person (the person IS the account,
// but still gets their own separate Contact record — the two entities store
// different information and a person can outlive one relationship).
export type CustomerKind = "company" | "individual";

export type Customer = {
  id: string;
  name: string;
  kind: CustomerKind;
  segmentId: string;
  stage: StageKey;
  followup: "set" | "overdue" | "none";
  problem: "yes" | "no" | "unknown";
  compatibility: CompatibilityLevel | null;
  priority?: Priority;
  website?: string;
  currentSolution?: string; // what they use/do instead, today
  interviewDate?: string; // display string, e.g. "Jul 6" — set once interviewed
  tags?: string[]; // needs / problem themes, board-filterable
  idleDays: number;
  ownerId: string;
  archived?: boolean;
  nextStep?: string;
};

export type QueueKind = "interview" | "review" | "followup" | "task" | "stale";

export type QueueItem = {
  id: string;
  kind: QueueKind;
  title: string;
  reason: string;
  when: string;
  action: string;
  hot?: boolean;
};

export const owners: Owner[] = [
  { id: "nima", name: "Nima", initials: "N", color: "#0295ac", email: "nima@glacianav.com", role: "admin", active: true },
  { id: "sara", name: "Sara", initials: "SA", color: "#6e5be8", email: "sara@glacianav.com", role: "member", active: true },
  { id: "jon", name: "Jon", initials: "JR", color: "#27b577", email: "jon@glacianav.com", role: "member", active: true },
];

export type NotificationPrefs = {
  staleDays: number;
  followupLeadHours: number;
  interviewLeadMinutes: number;
  emailDigest: boolean;
};

export const notificationPrefs: Record<string, NotificationPrefs> = {
  nima: { staleDays: 7, followupLeadHours: 24, interviewLeadMinutes: 30, emailDigest: true },
  sara: { staleDays: 5, followupLeadHours: 12, interviewLeadMinutes: 15, emailDigest: true },
  jon: { staleDays: 7, followupLeadHours: 24, interviewLeadMinutes: 30, emailDigest: false },
};

export type AppConfig = {
  ssoEnabled: boolean;
  ssoTenant: string;
  allowedDomains: string[];
  autoProvision: boolean;
  publicIntake: boolean;
};

export const appConfig: AppConfig = {
  ssoEnabled: true,
  ssoTenant: "glacianav.onmicrosoft.com",
  allowedDomains: ["glacianav.com"],
  autoProvision: true,
  publicIntake: true,
};

export const queueHealth = {
  pending: 0,
  processing: 1,
  failed: 0,
  last24h: 6,
  avgProcessMinutes: 4.2,
};

export const segments: Segment[] = [
  { id: "heli", name: "Heli-ski operators", color: "#14b8ce" },
  { id: "guides", name: "Mountain guides", color: "#6e5be8" },
  { id: "expedition", name: "Expedition operators", color: "#2f6fd0" },
];

// A rotation new groups cycle through so "add a group" never needs a color
// picker — same pattern as STAGE_TONE_ROTATION.
export const SEGMENT_COLOR_ROTATION = [
  "#2f6fd0",
  "#14b8ce",
  "#27b577",
  "#6e5be8",
  "#f26d5f",
];

export const stages: Stage[] = [
  { key: "contacted", label: "Contacted", tone: "gray" },
  { key: "interviewed", label: "Interviewed", tone: "cyan" },
  { key: "validated", label: "Validated", tone: "blue" },
  { key: "not_fit", label: "Not a fit", tone: "gray" },
];

export function stageByKey(key: StageKey, from: Stage[] = stages): Stage {
  return from.find((s) => s.key === key) ?? from[0];
}

// Fit against our ICP, not the customer's pain — a 5-step evaluative scale
// specific to this team's validation process, red (not compatible) through
// green (full match), replacing a generic 0-10 pain score.
export type CompatibilityLevel = "none" | "weak" | "possible" | "good" | "full";

export const COMPATIBILITY_LEVELS: {
  key: CompatibilityLevel;
  label: string;
  hex: string;
}[] = [
  { key: "none", label: "Not compatible", hex: "#CF5040" },
  { key: "weak", label: "Weak fit", hex: "#E2793D" },
  { key: "possible", label: "Possible fit", hex: "#D9B23C" },
  { key: "good", label: "Good fit", hex: "#8FB93C" },
  { key: "full", label: "Full match", hex: "#27B577" },
];

export function compatibilityByKey(key: CompatibilityLevel | null | undefined) {
  return COMPATIBILITY_LEVELS.find((c) => c.key === key);
}

export const customers: Customer[] = [
  {
    id: "jokull",
    name: "Jökull Expeditions",
    kind: "company",
    segmentId: "heli",
    stage: "interviewed",
    followup: "set",
    problem: "yes",
    compatibility: "good",
    priority: "high",
    website: "https://jokullexpeditions.is",
    currentSolution: "Paper route plans and radio check-ins",
    interviewDate: "Jul 6",
    tags: ["rope teams", "icefall", "route planning"],
    idleDays: 0,
    ownerId: "nima",
    nextStep: "Send rope-team protocol summary",
  },
  {
    id: "meridian",
    name: "Meridian Heli-Ski",
    kind: "company",
    segmentId: "heli",
    stage: "contacted",
    followup: "overdue",
    problem: "unknown",
    compatibility: "possible",
    priority: "medium",
    website: "https://meridianheliski.no",
    tags: ["season timing"],
    idleDays: 4,
    ownerId: "sara",
    nextStep: "Intro call they promised",
  },
  {
    id: "torres",
    name: "Torres Alpine Guides",
    kind: "company",
    segmentId: "guides",
    stage: "contacted",
    followup: "none",
    problem: "unknown",
    compatibility: "weak",
    priority: "low",
    website: "https://torresalpine.cl",
    idleDays: 9,
    ownerId: "jon",
  },
  {
    id: "arcticops",
    name: "ArcticOps",
    kind: "company",
    segmentId: "expedition",
    stage: "validated",
    followup: "set",
    problem: "yes",
    compatibility: "full",
    priority: "high",
    website: "https://arcticops.no",
    currentSolution: "Spreadsheet plus the ops whiteboard",
    interviewDate: "Jul 9",
    tags: ["route replanning", "pilot"],
    idleDays: 1,
    ownerId: "sara",
    nextStep: "Pilot scope draft",
  },
  {
    id: "svalbard",
    name: "Svalbard Traverse Co",
    kind: "company",
    segmentId: "expedition",
    stage: "interviewed",
    followup: "set",
    problem: "no",
    compatibility: "none",
    priority: "low",
    website: "https://svalbardtraverse.no",
    currentSolution: "Manual route checks; workaround is acceptable",
    interviewDate: "Jul 8",
    tags: ["staffing", "workaround"],
    idleDays: 2,
    ownerId: "jon",
  },
  {
    id: "kaukasus",
    name: "Kaukasus Lines",
    kind: "company",
    segmentId: "guides",
    stage: "contacted",
    followup: "none",
    problem: "unknown",
    compatibility: null,
    priority: "low",
    archived: true,
    idleDays: 6,
    ownerId: "nima",
  },
  {
    id: "wapta",
    name: "Wapta Icefield Tours",
    kind: "company",
    segmentId: "heli",
    stage: "validated",
    followup: "none",
    problem: "yes",
    compatibility: "full",
    priority: "high",
    website: "https://waptaicefield.ca",
    currentSolution: "Visual scouting only, no shared tooling",
    tags: ["visibility", "crevasse risk"],
    idleDays: 3,
    ownerId: "nima",
  },
  {
    id: "lofoten",
    name: "Lofoten Ridge Guides",
    kind: "company",
    segmentId: "guides",
    stage: "contacted",
    followup: "none",
    problem: "unknown",
    compatibility: null,
    idleDays: 1,
    ownerId: "nima",
  },
  {
    id: "denali",
    name: "Denali Basecamp Logistics",
    kind: "company",
    segmentId: "expedition",
    stage: "contacted",
    followup: "none",
    problem: "unknown",
    compatibility: null,
    idleDays: 5,
    ownerId: "sara",
  },
];

// ─── Contacts: the people, separate from the accounts they belong to ──
// A Contact stores person-level info (email, phone, LinkedIn, role) independent of
// any Customer. customerId is the primary-account link, set when a contact
// represents a company account or is created as the linked-record for an
// individual customer — but a contact can also exist unassigned.
export type Contact = {
  id: string;
  name: string;
  role?: string;
  customerId?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  preferredChannel?: ContactChannel;
};

export const contacts: Contact[] = [
  {
    id: "salome-berger",
    name: "Salome Berger",
    role: "IFMGA guide",
    customerId: "jokull",
    email: "salome.berger@jokullexpeditions.is",
    phone: "+354 555 0142",
    linkedin: "linkedin.com/in/salomeberger",
    preferredChannel: "phone",
  },
  {
    id: "anouk-fredheim",
    name: "Anouk Fredheim",
    role: "Ops lead",
    customerId: "meridian",
    email: "anouk@meridianheliski.no",
    phone: "+47 400 12 345",
    linkedin: "linkedin.com/in/anoukfredheim",
    preferredChannel: "email",
  },
  {
    id: "mateo-huenul",
    name: "Mateo Huenul",
    customerId: "torres",
    email: "mateo@torresalpine.cl",
    preferredChannel: "email",
  },
  {
    id: "ida-sorheim",
    name: "Ida Sørheim",
    role: "Founder",
    customerId: "arcticops",
    email: "ida@arcticops.no",
    phone: "+47 911 22 334",
    linkedin: "linkedin.com/in/idasorheim",
    preferredChannel: "linkedin",
  },
  {
    id: "elin-bratsberg",
    name: "Elin Bratsberg",
    customerId: "svalbard",
    email: "elin@svalbardtraverse.no",
    preferredChannel: "email",
  },
];

export function contactsForCustomer(customerId: string, from: Contact[] = contacts): Contact[] {
  return from.filter((p) => p.customerId === customerId);
}

export function primaryContactFor(customerId: string, from: Contact[] = contacts): Contact | undefined {
  return contactsForCustomer(customerId, from)[0];
}

// Contacts not (yet) tied to any account — pickable when assigning a
// company's primary contact.
export function unassignedContacts(): Contact[] {
  return contacts.filter((p) => !p.customerId);
}

// Mutates the shared fixture arrays directly (no backend yet): the create
// pages live on their own route and navigate back to the list, so the next
// mount reads these arrays fresh — same effect as a real persisted write.
export function createContact(input: {
  name: string;
  role?: string;
  customerId?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  preferredChannel?: ContactChannel;
}): Contact {
  const contact: Contact = { id: `contact-${Date.now()}`, ...input };
  contacts.push(contact);
  return contact;
}

export function createCustomer(input: {
  name: string;
  kind: CustomerKind;
  segmentId: string;
  ownerId: string;
  priority?: Priority;
  website?: string;
  contactId?: string; // link an existing contact as the primary contact
}): Customer {
  const customer: Customer = {
    id: `customer-${Date.now()}`,
    name: input.name,
    kind: input.kind,
    segmentId: input.segmentId,
    stage: stages[0]?.key ?? "contacted",
    followup: "none",
    problem: "unknown",
    compatibility: null,
    priority: input.priority,
    website: input.website,
    idleDays: 0,
    ownerId: input.ownerId,
  };
  customers.push(customer);
  if (input.contactId) {
    const linked = contactById(input.contactId);
    if (linked) linked.customerId = customer.id;
  }
  return customer;
}

export const queue: QueueItem[] = [
  {
    id: "q1",
    kind: "interview",
    title: "Jökull Expeditions with Salome Berger",
    reason: "today 14:00, you own this contact",
    when: "in 2 h",
    action: "Record",
    hot: true,
  },
  {
    id: "q2",
    kind: "review",
    title: "ArcticOps demo upload processed",
    reason: "summary, 5 action items, and a validation draft are ready",
    when: "38 min ago",
    action: "Review",
  },
  {
    id: "q3",
    kind: "followup",
    title: "Meridian Heli-Ski promised intro call",
    reason: "due Sunday, now 2 days past",
    when: "2 d over",
    action: "Open",
  },
  {
    id: "q4",
    kind: "task",
    title: "Send rope-team protocol summary",
    reason: "from the Jökull transcript at 12:47",
    when: "due Fri",
    action: "Open",
  },
  {
    id: "q5",
    kind: "stale",
    title: "Torres Alpine Guides is cooling off",
    reason: "9 days without a touch, stage still Contacted",
    when: "9 d",
    action: "Open",
  },
];

export const todaySlots: {
  time: string;
  kind: "free" | "busy" | "interview";
  label?: string;
}[] = [
  { time: "09", kind: "busy" },
  { time: "11", kind: "free" },
  { time: "13", kind: "free", label: "free until 14:00" },
  { time: "14", kind: "interview", label: "Interview · Jökull" },
  { time: "16", kind: "busy" },
];

export const funnel = [
  { label: "Contacted", count: 24, pct: 88, color: "#c9dcf6" },
  { label: "Interviewed", count: 11, pct: 42, color: "#7fa3e3" },
  { label: "Validated", count: 6, pct: 23, color: "#2f6fd0" },
];

// interviews per week, last 8 weeks
export const cadence = { points: [1, 2, 2, 3, 2, 4, 3, 3], target: 4 };

export const teamActivity = [
  { ownerId: "sara", text: "Sara reviewed the ArcticOps notes" },
  { ownerId: "jon", text: "Jon moved 2 contacts to Interviewed" },
];

export const counts = { customers: 41, library: 128, work: 7, contacts: contacts.length };

export function ownerById(id: string, from: Owner[] = owners): Owner {
  return from.find((o) => o.id === id) ?? from[0];
}

export function segmentById(id: string, from: Segment[] = segments): Segment {
  return from.find((s) => s.id === id) ?? from[0];
}

export const kpis = {
  interviews: { done: 3, target: 4 },
  followups: { open: 4, overdue: 1 },
  processed: { count: 6, delta: "+2 vs last week" },
};

export const upNext = {
  label: "Up next · in 2 h",
  title: "Interview: Jökull Expeditions",
  sub: "Salome Berger, IFMGA guide · you own this contact",
  time: "14:00",
  prep: 'Last conversation: pain 8/10 · "We plan around the icefall, not through it."',
  customerId: "jokull",
};

// ─── Calendar: layered ICS feeds + this week's events ──────────────────
// Mirrors the planned calendar_feeds/calendar_events schema: every user can
// subscribe any number of external ICS links (Gmail, MS365, Apple…) plus
// the always-on internal GlaciaNav feed (interviews, recordings, tasks).
// Real sync is backend work — this is the UI shape ahead of that pipeline.

export type CalendarFeedVisibility = "details" | "busy_only";
export type CalendarSyncStatus = "synced" | "syncing" | "error";

export type CalendarFeed = {
  id: string;
  ownerId: string;
  label: string;
  color: string;
  visibility: CalendarFeedVisibility;
  internal?: boolean; // the always-on GlaciaNav feed, not a subscribed ICS link
  syncStatus?: CalendarSyncStatus;
  lastSyncedMinutes?: number; // minutes ago; internal feed doesn't sync, it's live
};

export const calendarFeeds: CalendarFeed[] = [
  { id: "f1", ownerId: "nima", label: "GlaciaNav", color: "#0295ac", visibility: "details", internal: true },
  { id: "f2", ownerId: "nima", label: "Personal Gmail", color: "#6e5be8", visibility: "busy_only", syncStatus: "synced", lastSyncedMinutes: 6 },
  { id: "f3", ownerId: "nima", label: "MS365 work", color: "#2f6fd0", visibility: "busy_only", syncStatus: "synced", lastSyncedMinutes: 18 },
  { id: "f4", ownerId: "sara", label: "GlaciaNav", color: "#0295ac", visibility: "details", internal: true },
  { id: "f5", ownerId: "sara", label: "MS365 work", color: "#2f6fd0", visibility: "busy_only", syncStatus: "synced", lastSyncedMinutes: 11 },
  { id: "f6", ownerId: "jon", label: "GlaciaNav", color: "#0295ac", visibility: "details", internal: true },
  { id: "f7", ownerId: "jon", label: "Personal Gmail", color: "#6e5be8", visibility: "busy_only", syncStatus: "error", lastSyncedMinutes: 340 },
];

export function feedsForOwner(ownerId: string): CalendarFeed[] {
  return calendarFeeds.filter((f) => f.ownerId === ownerId);
}

export const CALENDAR_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export type CalendarDay = (typeof CALENDAR_DAYS)[number];
export const CALENDAR_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export type CalendarEventKind = "interview" | "recording" | "busy" | "hold";

export type CalendarEvent = {
  id: string;
  feedId: string;
  ownerId: string;
  day: CalendarDay;
  startHour: number;
  endHour: number;
  title: string;
  kind: CalendarEventKind;
  customerId?: string;
  allDay?: boolean;
};

export const calendarEvents: CalendarEvent[] = [
  { id: "e1", feedId: "f1", ownerId: "nima", day: "Mon", startHour: 9, endHour: 10, title: "Team standup", kind: "busy" },
  { id: "e2", feedId: "f1", ownerId: "nima", day: "Mon", startHour: 14, endHour: 15, title: "Interview · Jökull", kind: "interview", customerId: "jokull" },
  { id: "e3", feedId: "f2", ownerId: "nima", day: "Mon", startHour: 16, endHour: 17, title: "Busy", kind: "busy" },
  { id: "e4", feedId: "f1", ownerId: "nima", day: "Tue", startHour: 11, endHour: 12.5, title: "Demo debrief · ArcticOps", kind: "recording", customerId: "arcticops" },
  { id: "e5", feedId: "f3", ownerId: "nima", day: "Wed", startHour: 9, endHour: 9.5, title: "Busy", kind: "busy" },
  { id: "e5b", feedId: "f3", ownerId: "nima", day: "Wed", startHour: 10, endHour: 11, title: "Busy", kind: "busy" },
  { id: "e6", feedId: "f1", ownerId: "nima", day: "Thu", startHour: 13, endHour: 13.5, title: "Follow-up · Meridian", kind: "interview", customerId: "meridian" },
  { id: "e7", feedId: "f4", ownerId: "sara", day: "Mon", startHour: 9, endHour: 10, title: "Team standup", kind: "busy" },
  { id: "e8", feedId: "f5", ownerId: "sara", day: "Mon", startHour: 13, endHour: 15, title: "Busy", kind: "busy" },
  { id: "e9", feedId: "f4", ownerId: "sara", day: "Tue", startHour: 10, endHour: 11, title: "Interview · Salome Berger", kind: "interview", customerId: "jokull" },
  { id: "e10", feedId: "f5", ownerId: "sara", day: "Wed", startHour: 14, endHour: 16, title: "Busy", kind: "busy" },
  { id: "e11", feedId: "f4", ownerId: "sara", day: "Thu", startHour: 9, endHour: 10, title: "Team standup", kind: "busy" },
  { id: "e12", feedId: "f6", ownerId: "jon", day: "Mon", startHour: 9, endHour: 10, title: "Team standup", kind: "busy" },
  { id: "e13", feedId: "f7", ownerId: "jon", day: "Mon", startHour: 11, endHour: 12, title: "Busy", kind: "busy" },
  { id: "e14", feedId: "f6", ownerId: "jon", day: "Wed", startHour: 10, endHour: 11, title: "Interview · Torres Alpine", kind: "interview" },
  { id: "e15", feedId: "f7", ownerId: "jon", day: "Thu", startHour: 15, endHour: 17, title: "Busy", kind: "busy" },
  { id: "e16", feedId: "f6", ownerId: "jon", day: "Fri", startHour: 9, endHour: 10, title: "Team standup", kind: "busy" },
  { id: "e17", feedId: "f1", ownerId: "nima", day: "Wed", startHour: 8, endHour: 18, title: "Company offsite prep", kind: "hold", allDay: true },
  { id: "e18", feedId: "f7", ownerId: "jon", day: "Fri", startHour: 8, endHour: 18, title: "Jon — OOO", kind: "busy", allDay: true },
];

export function eventsForOwner(ownerId: string): CalendarEvent[] {
  return calendarEvents.filter((e) => e.ownerId === ownerId);
}

// ─── Library: topics + conversations (the notes-app model, unified) ───
// Topics are user-created colored collections with their own members — the
// notes app's Topics hub carried over. A conversation may attach to a
// customer, but never has to: weekly syncs and learning notes are first-class.

export type TopicVisibility = "private" | "selected" | "all";

export type Topic = {
  id: string;
  name: string;
  color: string; // data-palette hex
  visibility: TopicVisibility;
  memberIds: string[];
};

export type ConversationStatus = "processing" | "ready" | "reviewed";

export type Conversation = {
  id: string;
  title: string;
  topicId: string;
  // Customers attached as participants — zero, one, or several. A recording
  // is not "a customer's conversation"; it's a conversation that can be
  // linked to whichever customers were actually in the room, or to none
  // (weekly syncs, learning notes). Every participant sees it in their room.
  participantIds: string[];
  // People (Contacts) linked separately from their customer/account — the
  // specific person(s) this conversation is with or about, independent of
  // which company-level records are attached.
  contactIds: string[];
  authorId: string;
  when: string;
  duration: string;
  status: ConversationStatus;
  actionCount: number;
  shared: boolean; // private by default; shared = visible in the team feed
  summary?: string;
  wave: number[];
  // Set for a manually written note (no recording behind it). Presence of
  // this field marks a row as a note rather than an audio recording; notes
  // still use the full workspace page for links, actions, follow-ups, tags,
  // and comments.
  noteBody?: string;
  // Precomputed list-display counts for real data, so list cards (Library,
  // ConversationRow) don't need the full ConversationDetails (transcript,
  // etc.) just to show a badge. Falls back to detailsFor()-derived counts
  // for fixture data, which has no separate aggregate.
  openActionsCount?: number;
  decisionsCount?: number;
  chapterCount?: number;
  source?: "record" | "upload";
};

export const topics: Topic[] = [
  { id: "interviews", name: "Customer interviews", color: "#14b8ce", visibility: "all", memberIds: ["nima", "sara", "jon"] },
  { id: "weekly", name: "Weekly sync", color: "#6e5be8", visibility: "all", memberIds: ["nima", "sara", "jon"] },
  { id: "learning", name: "Learning", color: "#27b577", visibility: "selected", memberIds: ["nima", "sara"] },
];

// Ordered by recency, newest first.
export const conversations: Conversation[] = [
  {
    id: "n2",
    title: "Validation note: Meridian timing risk",
    topicId: "interviews",
    participantIds: ["meridian"],
    contactIds: ["anouk-fredheim"],
    authorId: "sara",
    when: "12 min ago",
    duration: "note",
    status: "ready",
    actionCount: 2,
    shared: false,
    wave: [],
    noteBody:
      "Meridian is interested, but the operating calendar is the blocker. They are open to a September pilot if the glacier season does not overrun. Need a clearer seasonal trigger before marking them validated.",
  },
  {
    id: "c9",
    title: "Field notes: icefall traverse",
    topicId: "learning",
    participantIds: [],
    contactIds: [],
    authorId: "nima",
    when: "20 min ago",
    duration: "8 min",
    status: "processing",
    actionCount: 0,
    shared: false,
    wave: [9, 13, 7, 16, 11, 18, 8, 14, 10, 17, 12, 15],
  },
  {
    id: "n1",
    title: "Pricing objection synthesis",
    topicId: "learning",
    participantIds: ["arcticops", "jokull"],
    contactIds: ["ida-sorheim", "salome-berger"],
    authorId: "nima",
    when: "1 h ago",
    duration: "note",
    status: "reviewed",
    actionCount: 3,
    shared: true,
    summary:
      "The strongest willingness-to-pay signal is tied to rotation cost, not seats. Budget owners respond better to avoided replanning time than workflow polish.",
    wave: [],
    noteBody:
      "Two threads are converging: ArcticOps frames value around weather-window replanning time, while Jökull frames it around protocol confidence and budget ownership. Seat pricing feels weak for both. The next pricing draft should anchor to avoided rotation disruption and include a smaller validation wedge for guide-led teams.",
  },
  {
    id: "c1",
    title: "Demo debrief",
    topicId: "interviews",
    participantIds: ["arcticops"],
    contactIds: ["ida-sorheim"],
    authorId: "sara",
    when: "38 min ago",
    duration: "27 min",
    status: "ready",
    actionCount: 5,
    shared: true,
    summary:
      "Ida walked through the current rotation-planning workflow. Route replanning is the biggest drain; the team re-does it after every weather window. Strong pull toward a pilot scoped to the Svalbard season.",
    wave: [8, 14, 20, 11, 17, 9, 15, 19, 7, 12, 16, 10],
  },
  {
    id: "c2",
    title: "Problem interview",
    topicId: "interviews",
    participantIds: ["svalbard"],
    contactIds: ["elin-bratsberg"],
    authorId: "jon",
    when: "yesterday",
    duration: "34 min",
    status: "reviewed",
    actionCount: 2,
    shared: true,
    summary:
      "Elin sees the problem but ranks it below staffing. Pain 3/10; current workaround is acceptable at their scale. Keep warm, revisit before next season.",
    wave: [12, 7, 16, 10, 18, 13, 8, 15, 11, 19, 9, 14],
  },
  {
    id: "c4",
    title: "Weekly sync",
    topicId: "weekly",
    // Internal meeting, but two accounts were on the agenda — showing up in
    // both Jökull's and Meridian's customer pages, not just Library.
    participantIds: ["jokull", "meridian"],
    contactIds: ["anouk-fredheim"],
    authorId: "nima",
    when: "2 d ago",
    duration: "22 min",
    status: "ready",
    actionCount: 3,
    shared: true,
    summary:
      "Pipeline review and interview cadence. Decided to prioritize heli-ski operators through July and move Torres to Jon.",
    wave: [10, 15, 8, 17, 12, 19, 9, 14, 11, 16, 7, 13],
  },
  {
    id: "c3",
    title: "Problem interview",
    topicId: "interviews",
    participantIds: ["jokull"],
    contactIds: ["salome-berger"],
    authorId: "nima",
    when: "3 d ago",
    duration: "41 min",
    status: "reviewed",
    actionCount: 4,
    shared: true,
    summary:
      "Salome detailed rope-team planning around the icefall. Pain 8/10, budget owner confirmed. Follow-up booked; protocol summary owed.",
    wave: [14, 9, 18, 12, 7, 16, 11, 19, 8, 15, 10, 17],
  },
  {
    id: "c6",
    title: "AssemblyAI diarization notes",
    topicId: "learning",
    participantIds: [],
    contactIds: [],
    authorId: "nima",
    when: "4 d ago",
    duration: "12 min",
    status: "ready",
    actionCount: 1,
    shared: false,
    summary:
      "Speaker labels degrade past six voices; chunked re-alignment looks like the fix. Worth a spike before the pipeline phase.",
    wave: [7, 12, 16, 9, 14, 18, 10, 15, 8, 13, 17, 11],
  },
  {
    id: "c8",
    title: "Intro call recap",
    topicId: "interviews",
    participantIds: ["meridian"],
    contactIds: ["anouk-fredheim"],
    authorId: "sara",
    when: "6 d ago",
    duration: "15 min",
    status: "reviewed",
    actionCount: 1,
    shared: true,
    summary:
      "Short intro with Anouk. Interested but slammed until the glacier season ends; promised a proper call this week.",
    wave: [11, 16, 8, 14, 19, 10, 15, 7, 17, 12, 18, 9],
  },
  {
    id: "c5",
    title: "Weekly sync",
    topicId: "weekly",
    participantIds: [],
    contactIds: [],
    authorId: "sara",
    when: "9 d ago",
    duration: "25 min",
    status: "reviewed",
    actionCount: 2,
    shared: true,
    wave: [13, 8, 17, 11, 15, 9, 18, 12, 7, 16, 10, 14],
  },
  {
    id: "c7",
    title: "Pricing research readout",
    topicId: "learning",
    participantIds: [],
    contactIds: [],
    authorId: "sara",
    when: "2 w ago",
    duration: "18 min",
    status: "ready",
    actionCount: 2,
    shared: true,
    summary:
      "Comparable tools price per seat with a capture add-on. Willingness-to-pay interviews suggest anchoring on rotation cost, not seats.",
    wave: [9, 14, 7, 18, 12, 16, 10, 15, 8, 17, 11, 13],
  },
];

// ─── Conversation workspace: the notes-app post-transcription model ───
// Mirrors the notes schema split (recordings / transcripts / results):
// the list model above stays lean, per-conversation depth lives here.

export type Speaker = { label: string; name?: string; color: string };

export type Utterance = {
  speaker: string; // raw label; display name comes from speakers[]
  text: string;
  startMs: number;
  lowConfidence?: boolean;
};

export type Chapter = { title: string; summary?: string; startMs: number };

export type ActionItem = {
  id: string;
  task: string;
  assigneeIds: string[];
  dueLabel?: string;
  status: "open" | "done";
  sourceMs?: number; // transcript trace anchor
};

export type TraceItem = { text: string; sourceMs?: number };

export type QaMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: { quote: string; startMs: number; speaker?: string }[];
};

export type ConversationComment = {
  authorId: string;
  body: string;
  atMs?: number; // optional transcript anchor
  when: string;
};

export type ConversationDetails = {
  source: "record" | "upload";
  language?: string;
  durationMs: number;
  editedBy?: string; // owner id who curated the AI notes
  speakers?: Speaker[];
  chapters?: Chapter[];
  actionItems?: ActionItem[];
  decisions?: TraceItem[];
  followUps?: TraceItem[];
  aiTags?: string[]; // AI-extracted keywords; NOT Topic collections
  utterances?: Utterance[];
  qa?: QaMessage[];
  comments?: ConversationComment[];
};

export const conversationDetails: Record<string, ConversationDetails> = {
  n2: {
    source: "upload",
    language: "Written note",
    durationMs: 0,
    editedBy: "sara",
    actionItems: [
      { id: "a1", task: "Ask Anouk for a September pilot window", assigneeIds: ["sara"], dueLabel: "Thu", status: "open" },
      { id: "a2", task: "Add seasonal overrun risk to Meridian validation", assigneeIds: ["jon"], status: "open" },
    ],
    decisions: [
      { text: "Do not mark Meridian as validated until season timing is confirmed." },
    ],
    followUps: [
      { text: "Follow up after their glacier season planning call." },
      { text: "Send a shorter pilot outline that avoids peak-season implementation." },
    ],
    aiTags: ["season timing", "pilot window", "validation risk", "Meridian"],
    comments: [
      { authorId: "nima", body: "Good call keeping this out of validated until the calendar risk clears.", when: "8 min ago" },
    ],
  },
  n1: {
    source: "upload",
    language: "Written note",
    durationMs: 0,
    editedBy: "nima",
    actionItems: [
      { id: "a1", task: "Draft pricing language around avoided rotation disruption", assigneeIds: ["nima"], dueLabel: "Fri", status: "open" },
      { id: "a2", task: "Ask Sara to pressure-test the rotation-cost anchor with Ida", assigneeIds: ["sara"], status: "open" },
      { id: "a3", task: "Move seat-based pricing notes into the parking lot", assigneeIds: ["jon"], status: "done" },
    ],
    decisions: [
      { text: "Lead pricing conversations with avoided replanning time, not seat count." },
      { text: "Keep a smaller validation wedge for guide-led teams." },
    ],
    followUps: [
      { text: "Compare Jökull and ArcticOps language before the next pricing review." },
    ],
    aiTags: ["pricing", "rotation cost", "budget owner", "replanning", "guide-led teams"],
    comments: [
      { authorId: "sara", body: "This matches Ida's board language better than the old seat-pack draft.", when: "44 min ago" },
    ],
  },
  c1: {
    source: "record",
    language: "English",
    durationMs: 1_620_000,
    editedBy: "sara",
    speakers: [
      { label: "A", name: "Sara", color: "#6e5be8" },
      { label: "B", name: "Ida Sørheim", color: "#14b8ce" },
    ],
    chapters: [
      { title: "Current rotation-planning workflow", summary: "How ArcticOps plans a season today: spreadsheets plus the ops whiteboard.", startMs: 60_000 },
      { title: "The replanning problem", summary: "Every weather window forces a full replan; two evenings per rotation.", startMs: 420_000 },
      { title: "Demo walkthrough", summary: "Route layers, feed overlays, and the shared availability view.", startMs: 780_000 },
      { title: "Pilot scope discussion", summary: "What a Svalbard-season pilot would need to prove.", startMs: 1_260_000 },
    ],
    actionItems: [
      { id: "a1", task: "Draft pilot scope for the Svalbard season", assigneeIds: ["sara"], dueLabel: "Fri", status: "open", sourceMs: 1_305_000 },
      { id: "a2", task: "Send route-layer demo recording to Ida", assigneeIds: ["sara"], status: "done", sourceMs: 810_000 },
      { id: "a3", task: "Price the per-rotation anchor with Jon", assigneeIds: ["jon"], dueLabel: "next week", status: "open", sourceMs: 1_380_000 },
      { id: "a4", task: "Collect two seasons of replanning logs", assigneeIds: ["nima", "sara"], status: "open", sourceMs: 505_000 },
      { id: "a5", task: "Intro to their weather-data provider", assigneeIds: [], status: "open" },
    ],
    decisions: [
      { text: "Pilot is scoped to the Svalbard season only, one ops team.", sourceMs: 1_290_000 },
      { text: "ArcticOps shares anonymized replanning logs before kickoff.", sourceMs: 495_000 },
      { text: "Success metric: replanning time per weather window, not seat count.", sourceMs: 1_430_000 },
    ],
    followUps: [
      { text: "Ida checks internally whether the board approves a paid pilot.", sourceMs: 1_500_000 },
      { text: "Revisit multi-team rollout after the season review." },
    ],
    aiTags: ["route replanning", "weather windows", "pilot", "rotation cost", "Svalbard", "ops workflow"],
    utterances: [
      { speaker: "A", text: "Walk me through what happens when a weather window moves.", startMs: 415_000 },
      { speaker: "B", text: "Honestly? Everything stops. The whole rotation gets replanned from the spreadsheet up.", startMs: 424_000 },
      { speaker: "A", text: "How long does that take, start to finish?", startMs: 447_000 },
      { speaker: "B", text: "Route replanning eats two evenings of every rotation. Two of my best people, every time.", startMs: 452_000 },
      { speaker: "B", text: "And if the forecast flips again mid-replan, we start over.", startMs: 489_000, lowConfidence: true },
      { speaker: "A", text: "If the pilot only proved one thing, what should it be?", startMs: 1_286_000 },
      { speaker: "B", text: "That a window moving costs us an hour, not two evenings. Prove that and the board listens.", startMs: 1_294_000 },
      { speaker: "A", text: "Then let's scope exactly that for the Svalbard season.", startMs: 1_318_000 },
    ],
    qa: [
      { role: "user", content: "What convinced her, and what's still blocking the pilot?" },
      {
        role: "assistant",
        content: "The demo of route layers landed hardest; Ida connected it directly to the two evenings her team loses per rotation. The open blocker is internal: board approval for a paid pilot, which she took as a follow-up.",
        citations: [
          { quote: "Route replanning eats two evenings of every rotation.", startMs: 452_000, speaker: "B" },
          { quote: "Prove that and the board listens.", startMs: 1_294_000, speaker: "B" },
        ],
      },
    ],
    comments: [
      { authorId: "nima", body: "This is the strongest pain evidence we have — pull the two-evenings quote into the validation note.", atMs: 452_000, when: "30 min ago" },
      { authorId: "sara", body: "@Nima on it. Pilot scope draft goes out Friday.", when: "12 min ago" },
    ],
  },
  c3: {
    source: "record",
    language: "English",
    durationMs: 2_460_000,
    speakers: [
      { label: "A", name: "Nima", color: "#0295ac" },
      { label: "B", name: "Salome Berger", color: "#f26d5f" },
    ],
    chapters: [
      { title: "Rope-team planning today", startMs: 180_000 },
      { title: "The icefall constraint", summary: "Why routes bend around the icefall and who decides.", startMs: 960_000 },
      { title: "Budget and next steps", startMs: 2_100_000 },
    ],
    actionItems: [
      { id: "a1", task: "Send rope-team protocol summary", assigneeIds: ["nima"], dueLabel: "Fri", status: "open", sourceMs: 767_000 },
      { id: "a2", task: "Book follow-up with Salome", assigneeIds: ["nima"], status: "done" },
      { id: "a3", task: "Map their icefall decision chain", assigneeIds: ["nima"], status: "open", sourceMs: 1_010_000 },
      { id: "a4", task: "Share pilot pricing sketch", assigneeIds: ["sara"], status: "open", sourceMs: 2_190_000 },
    ],
    decisions: [
      { text: "Salome owns the budget decision; no committee.", sourceMs: 2_130_000 },
      { text: "Protocol summary goes out before the follow-up.", sourceMs: 770_000 },
    ],
    followUps: [{ text: "Follow-up interview booked for today 14:00." }],
    aiTags: ["rope teams", "icefall", "route planning", "budget owner"],
    utterances: [
      { speaker: "A", text: "When a route crosses the icefall zone, who makes the call?", startMs: 962_000 },
      { speaker: "B", text: "Me. We plan around the icefall, not through it. Every season, no exceptions.", startMs: 971_000 },
      { speaker: "A", text: "And the rope-team assignments follow from that?", startMs: 998_000 },
      { speaker: "B", text: "Everything follows from that. Send me your protocol summary and I'll mark where it breaks.", startMs: 1_004_000 },
      { speaker: "B", text: "On budget: that's my signature, if the follow-up goes well.", startMs: 2_126_000 },
    ],
    comments: [
      { authorId: "jon", body: "Pain 8 with a confirmed budget owner — this should anchor the segment review.", when: "2 d ago" },
    ],
  },
  c2: {
    source: "record",
    language: "English",
    durationMs: 2_040_000,
    decisions: [
      { text: "Keep warm; revisit before next season.", sourceMs: 1_820_000 },
      { text: "No pilot conversation at their current scale." },
    ],
    aiTags: ["staffing", "workaround", "low pain"],
  },
  c4: {
    source: "record",
    language: "English",
    durationMs: 1_320_000,
    actionItems: [
      { id: "a1", task: "Prioritize heli-ski operators through July", assigneeIds: ["nima", "sara", "jon"], status: "open" },
      { id: "a2", task: "Move Torres Alpine Guides to Jon", assigneeIds: ["jon"], status: "done" },
      { id: "a3", task: "Draft the interview cadence for August", assigneeIds: ["nima"], dueLabel: "Mon", status: "open" },
    ],
    aiTags: ["pipeline", "cadence", "segment focus"],
  },
  c6: { source: "upload", language: "English", durationMs: 720_000, aiTags: ["diarization", "speaker labels", "pipeline spike"] },
  c8: { source: "record", language: "English", durationMs: 900_000, aiTags: ["intro call", "season timing"] },
  c5: { source: "record", language: "English", durationMs: 1_500_000 },
  c7: { source: "upload", language: "English", durationMs: 1_080_000, aiTags: ["pricing", "willingness to pay", "rotation cost"] },
  c9: { source: "record", durationMs: 480_000 },
};

export function detailsFor(conversationId: string): ConversationDetails | undefined {
  return conversationDetails[conversationId];
}

// ─── Customer page: validation notes + activity ───────────────────────

export type ValidationNote = {
  id: string;
  authorId: string;
  when: string;
  body: string;
  quote?: string;
  conversationId?: string;
};

export const validationNotes: Record<string, ValidationNote[]> = {
  jokull: [
    {
      id: "v1",
      authorId: "nima",
      when: "3 d ago",
      body: "Problem confirmed at pain 8. Planning around the icefall is a standing constraint, rope-team assignments follow from it, and Salome owns the budget decision alone.",
      quote: "We plan around the icefall, not through it.",
      conversationId: "c3",
    },
  ],
  arcticops: [
    {
      id: "v1",
      authorId: "sara",
      when: "38 min ago",
      body: "Replanning cost validated: two evenings per rotation, two senior people. Pilot scoped to the Svalbard season; success metric is replanning time per weather window, not seats.",
      quote: "Route replanning eats two evenings of every rotation.",
      conversationId: "c1",
    },
    {
      id: "v2",
      authorId: "sara",
      when: "2 w ago",
      body: "Initial hypothesis matched on the first call: rotation planning lives in spreadsheets with no shared availability view.",
    },
  ],
  svalbard: [
    {
      id: "v1",
      authorId: "jon",
      when: "yesterday",
      body: "Problem present but low urgency (pain 3); the current workaround is acceptable at their scale. Not a pilot fit now — keep warm and revisit before next season.",
      conversationId: "c2",
    },
  ],
};

// A task added straight from the customer page — not sourced from a
// recording's action board, so it carries no conversationId.
export type ManualTask = {
  id: string;
  task: string;
  assigneeIds: string[];
  dueLabel?: string;
  status: "open" | "done";
};

export const customerTasks: Record<string, ManualTask[]> = {
  arcticops: [
    {
      id: "m1",
      task: "Chase board approval for the paid pilot",
      assigneeIds: ["sara"],
      dueLabel: "Fri",
      status: "open",
    },
  ],
  kaukasus: [
    {
      id: "m1",
      task: "Send updated pilot pricing sheet",
      assigneeIds: ["nima"],
      dueLabel: "Today",
      status: "open",
    },
  ],
  denali: [
    {
      id: "m1",
      task: "Confirm rescheduled interview time",
      assigneeIds: ["jon"],
      dueLabel: "2d overdue",
      status: "open",
    },
  ],
};

export type ActivityEvent = { when: string; text: string; ownerId: string };

export const customerActivity: Record<string, ActivityEvent[]> = {
  jokull: [
    { when: "in 2 h", text: "Follow-up interview scheduled for 14:00", ownerId: "nima" },
    { when: "3 d ago", text: "Problem interview recorded, 41 min", ownerId: "nima" },
    { when: "1 w ago", text: "Moved from Contacted to Interviewed", ownerId: "nima" },
    { when: "2 w ago", text: "Added from the intake form", ownerId: "sara" },
  ],
  arcticops: [
    { when: "38 min ago", text: "Demo debrief processed, validation note drafted", ownerId: "sara" },
    { when: "1 d ago", text: "Moved from Interviewed to Validated", ownerId: "sara" },
    { when: "1 w ago", text: "Demo session booked", ownerId: "sara" },
  ],
  svalbard: [
    { when: "yesterday", text: "Problem interview recorded, 34 min", ownerId: "jon" },
    { when: "5 d ago", text: "Moved from Contacted to Interviewed", ownerId: "jon" },
  ],
};

export function topicById(id: string, from: Topic[] = topics): Topic {
  return from.find((t) => t.id === id) ?? from[0];
}

export function customerById(id: string, from: Customer[] = customers): Customer | undefined {
  return from.find((c) => c.id === id);
}

export function conversationsForCustomer(customerId: string, from: Conversation[] = conversations): Conversation[] {
  return from.filter((c) => c.participantIds.includes(customerId));
}

export function participantsFor(c: Conversation, from: Customer[] = customers): Customer[] {
  return c.participantIds
    .map((id) => customerById(id, from))
    .filter((x): x is Customer => x != null);
}

export function contactById(id: string, from: Contact[] = contacts): Contact | undefined {
  return from.find((p) => p.id === id);
}

export function linkedContactsFor(c: Conversation, from: Contact[] = contacts): Contact[] {
  return c.contactIds
    .map((id) => contactById(id, from))
    .filter((x): x is Contact => x != null);
}
