# GlaciaNav Workspace — design system: "Firn" (vibrant calibration)

Firn is compacted snow on its way to becoming glacier ice. The interface reads
like looking down into clear ice: cold, luminous, layered. **Hierarchy is
depth** — whatever you are working on rises to the surface; everything at rest
sits low and cool. Light-first; the dark theme ("under the ice") is a later,
deliberate pass planned at the token layer.

This file is the gate: no UI ships that violates it. Reference artifacts:
- Direction board: https://claude.ai/code/artifact/ade2c108-a1e3-4351-ab9e-5c0b62f37f10
- Structure + key screens: https://claude.ai/code/artifact/4e65ddb8-2993-4b3b-817b-c3f6abd4a27a

## 1. Identity anchor — the depth axis

- Resting layers sit low: the ice-field gradient ground, recessed wells.
- Content sits on the surface: white panels with cool, layered shadows.
- The active thing rises: 1–2 px lift, widening blue-tinted shadow, 180 ms.
- **One deep element per screen**: only the Cass dock/panel wears the deep
  pool color. Nothing else goes dark.

## 2. Tokens (source of truth: `src/app/globals.css`)

Core: ice-0 `#E9F5F9` · ice-1 `#DDEFF6` · surface `#FFFFFF` · surface-2
`#F2F9FB` · ink `#0A2E38` · ink-2 `#3E6470` · ink-3 `#54717E` · line `#D2E5EC`
· line-2 `#E2EEF2` · **meltwater `#0295AC`** · signal `#16CBDF` · deep
`#0B3D4D` · deep-ink `#D9EEF2`.

Data palette (validated for CVD separation; cyan/green/coral require visible
labels on white): melt cyan `#14B8CE` · aurora green `#27B577` · crevasse
violet `#6E5BE8` · alpenglow `#F26D5F` · serac blue `#2F6FD0`.

**Color rules**
- Meltwater is the only brand accent and always means *interactive*.
- The data palette belongs to user content: stages, tags, owners, calendar
  feeds, queue-row types. Chrome never uses data colors.
- Semantic states (error/warning/success) are separate from both; destructive
  actions wear alpenglow-family red (`#CF5040`), never the brand accent.
- Colored marks always carry visible text labels (contrast relief).

## 3. Depth grammar (no decorative borders)

Elements are either **surfaced objects** or **recessed pools**; 1 px bordered
boxes are banned as a sectioning device.

- `.surfaced` — white gradient surface, inset top highlight (light catching an
  edge), close contact shadow + deep cool ambient shadow.
- `.surfaced-lg` — the same at frame scale (mock frames, drawers, dialogs).
- `.recessed` — sunk well: petrol-tinted fill, inset shadow, bottom light lip.
- `.risen` / `.rise-on-hover` — the lift: translateY(-1px) + widened shadow +
  optional 1.5 px meltwater ring for the active/hot object.
- Page/section grounds may descend in strata (progressively deeper ice tints
  separated by hairline strata lines with an inset light edge).
- Borders survive only where they are structural (calendar grid, table rules).

## 4. Type

- **Schibsted Grotesk** — display and UI. Display: 600, tight tracking
  (-0.01 to -0.025 em). Body: 400/500.
- **Spline Sans Mono** — data voice: timestamps, durations, counts, keyboard
  hints. `tabular-nums` wherever digits align.
- No third face. No italic serif flourishes. Sentence case everywhere; small
  uppercase labels (10.5–12 px, 0.11–0.14 em tracking) only for section labels
  and card headers, rationed.
- **Readability floors**: primary row/body text ≥ 15 px; secondary text
  ≥ 13.5 px; meta/mono ≥ 12 px; uppercase micro-labels ≥ 11.5 px. Nothing
  below 11.5 px, ever. `ink-3` is for short meta lines only (≥ 4.5:1 on
  surface), never paragraphs; long secondary copy wears `ink-2`. Controls
  carrying 14px labels are ≥ 32 px (h-8) tall.
- **Section headers are instruments, not floating text**: anchor tick
  (petrol 30%, or the entity's data color) or a Phosphor icon, uppercase
  label in ink-2, mono count chip, hairline rule running to the section
  edge, optional right-aligned action. Component: `ui/section-header.tsx`.

## 5. Icons

- **Phosphor only** (`@phosphor-icons/react`), one weight per context
  (regular), 16–18 px in chrome. Nothing hand-drawn, no emoji, no second set.
- Icons live in the rail, top bar, buttons, and card headers. **Rows never get
  per-item icons** — row type is carried by the tinted type label.
- **Every module header carries an icon medallion**: `PageHeader`'s optional
  `icon` prop renders a `h-12 w-12 rounded-2xl bg-melt/10 text-melt` badge
  before the title (matches the rail's icon for that destination). Detail
  pages with a bespoke (non-`PageHeader`) header — Customer page, Conversation
  Workspace — use a smaller `h-11 w-11` medallion in the same style, colored
  by the record's own data (segment color for a customer, showing a
  `Buildings`/`User` icon by `kind`) rather than a generic module icon, since
  they represent one specific entity, not a list. Phosphor icon components
  use React context internally, so any component that renders one directly
  must be `"use client"` — a bare Server Component page passing an icon
  through as a prop still breaks the build (`createContext is not a
  function`) unless the render site itself is client-boundary.

## 6. The shell

- **Left rail (~232 px)**: brand row; grouped destinations — Home, then
  `RECORDS` (Customers, Library), `PLAN` (Work, Calendar), `INTELLIGENCE`
  (Insights, Ask); footer (Settings, Admin, user chip). Items 28 px on an 8 px
  grid; active = 2 px meltwater tick on the rail edge + quiet surface tint +
  600 weight — never a floating pill or shadow. Counts right-aligned mono.
  **The rail holds no buttons.**
- **Top bar (52 px)**: module title · search with ⌘K hint inside the field ·
  `+ New` menu (record, upload, customer, note) · bell · avatar. One row,
  hairline below, nothing else.
- **Drawer**: any list click opens a right overlay drawer (quick view,
  editable, deep-linkable URL) with an "open full" affordance. Full pages are
  for work with its own sub-navigation.
- **Cass dock**: bottom-right, deep pool pill; opens a panel auto-scoped to
  the current context — on a customer page, scope narrows to that customer
  and every conversation they participate in, with quick actions (draft an
  agenda, turn open items into to-dos). Cass actions always confirm before
  writing.
- **Capture is a feature, not the centerpiece**: + New, ⌘R, and context rows;
  a recording can be tagged with zero, one, or several customer participants
  (add/remove chips on the record screen); minimizes to a floating pill bar
  — deliberately minimal, no participant chrome there — so the workspace
  stays usable while it keeps rolling.

## 7. Motion

- The rise: hover/focus lift, 180 ms ease; color/opacity transitions 150–200ms.
- GSAP (`@gsap/react`) reserved for orchestrated moments only: first-load
  surface reveal (staggered rise of queue/cards), transcript playhead,
  count-up metrics. Every animation must be justified (hierarchy, feedback,
  state); nothing loops idly.
- All motion collapses under `prefers-reduced-motion`.

## 8. Dialogs, confirms, toasts

- **Never browser-native** `alert`/`confirm`/`prompt`.
- Dialog = Firn card over a petrol scrim `rgba(10,46,56,0.55+)`; focus
  trapped; Esc and outside click cancel; exactly one primary action.
- Destructive: alpenglow-red filled button + explicit consequence copy.
- Cass proposals: deep pool card with Confirm (signal tint) / Skip.
- Toasts confirm in the same words as the button that acted, auto-dismiss,
  and carry Undo whenever reversible.
- Dialogs only for irreversible or multi-field moments; else inline/drawer.

## 9. Data visualization

- Funnel/magnitude: single hue (serac blue ramp), direct count labels in ink.
- Sparklines: 2 px meltwater line, emphasized endpoint dot, ink caption.
- Calendar: each feed is an entity and keeps its color (leading color edge on
  event blocks — the calendar convention); teammates render as neutral striped
  busy-only blocks; computed shared free time = dashed meltwater outline.
- Text wears text tokens, never series colors. One axis, no dual-axis charts.

## 10. Copy

- Sentence case; active voice; a control says exactly what happens, and keeps
  its name through the flow ("Delete conversation" → toast "Conversation
  deleted").
- Queue rows explain *why they surfaced* in one quiet line.
- Errors say what went wrong and how to fix it; empty states invite the next
  action (new workspace = setup checklist).
- No em dashes in UI copy.

## 11. Module map (structure v2)

Home (attention queue: interviews next → ready for review → follow-ups due →
my tasks → going stale; side: Today, Pipeline pulse, Team activity) ·
Customers (account board grouped by segment) and Validation Progress (separate
Kanban-by-stage page) are split destinations: Customers owns account inventory,
column visibility, segment grouping, and quick-view drawers; Validation Progress
owns stage movement, stage creation, and stage renaming. The old combined
Board/Kanban lens switch is gone.
**No pre-qualification step**: the earlier "Unqualified leads" group +
Promote action (itself a fold-in of the original Inbox tab) was removed
entirely — Nima called it out twice as not making sense, so every customer
is just a normal segment row from the start, no separate bucket. A filter
bar in the header (Board lens only): free-text search (name/contact), a
lead filter (Everyone / a specific person), and a Columns menu — 11
toggleable columns matching the CRM's own list (Stage, Problem, Needs/tags,
Channel, Current solution, Follow-up, Interview date, Priority,
Compatibility, Next step, Notes count; Name + Lead avatar stay
always-visible), 5 visible by default (Stage, Problem, Follow-up, Priority,
Compatibility — deliberately lean so the un-customized row stays inside one
viewport width), persisted to localStorage `gn-board-columns` (mirrors
CRM's `crm-visible-columns`). **Row is a real single-line grid table, not a
stacking card**: a shared header bar (`Customer | Stage | Problem | ... |
Lead`) sits once above the segment groups, and every row uses the identical
`grid-template-columns` — a fixed pixel width per column
(`board-view.tsx`'s `COLUMN_WIDTH` map, mirroring the CRM's own
`gridTemplate()` helper) plus a flexible-but-bounded 260px name column and a
56px Lead-avatar column. Cell content truncates (ellipsis + `title`
tooltip) rather than wrapping — a row's height never changes no matter how
many columns are toggled on. When the sum of visible columns exceeds the
viewport, the *whole board* (header + every group) sits in one shared
`overflow-x-auto` container and scrolls horizontally together, staying
column-aligned — it never wraps a row onto a second line. **Compatibility**
replaces the old generic 0–10 pain score: a 5-step ICP-fit scale specific to
this team's validation process — Not compatible → Weak fit → Possible fit →
Good fit → Full match, each with its own color running red→orange→amber→
yellow-green→green (`COMPATIBILITY_LEVELS` in fixtures.ts, rendered by
`compatibility-badge.tsx`) — deliberately distinct from "pain," which stays
in interview quotes/notes as the *customer's own language* for their
problem severity, not a structured field. A floating Stage filter dock
pinned to the bottom (CRM's StageDock) — one pill per stage with a count +
stacked lead avatars, click narrows the segment groups to that stage only.
**Segments are user-creatable groups, same as Stage**: a dashed "+ Add
group" row sits at the end of the Board's segment list (`board-view.tsx`'s
`AddGroupRow`, cycling `SEGMENT_COLOR_ROTATION` for the new group's color,
same pattern as `STAGE_TONE_ROTATION`) — every group, including a brand-new
empty one, always renders its section (the board no longer hides
zero-customer segments, so creating a group is immediately visible and you
can drag a customer straight into it). Stages are the same kind of user
data: Kanban has an inline "+ Add stage" + click-to-rename headers, and its
stage columns are a fixed-width (`COLUMN_WIDTH = 300`) horizontally
scrolling row (`flex overflow-x-auto`, never `grid-cols-3` wrapping) — a
4th+ stage extends the row sideways, it never drops to a second row of
columns, matching the Board's own never-wrap-vertically rule. **Customer
Room** ("the customer page") tabs:
Overview, Conversations, Validation notes, Tasks, Activity, Files —
Stage/Follow-up/Problem in the header are all pickers (click → dropdown →
changes the record directly, not read-only); Validation notes and Tasks
both take manual entries now ("+ Add validation note" / "+ Add task",
dashed-border affordance) alongside recording-sourced ones — recordings
were never the only source. UI-facing label is **Lead**, not Owner (matches
the CRM's own copy — its `owner` field is user-facing "Lead" too); the
underlying field stays `ownerId`/`Owner` internally, only display strings
changed. **Avatar legibility**: `ui/avatar.tsx`'s initials font floor raised
9px→11px (ratio 0.4→0.42 of diameter), and every list/row avatar size
bumped app-wide (Board row 24→32, Room header 26→34, Library row 24→28,
etc.) — initials were unreadable at the old sizes. **The customer quick-view
drawer** ("the customer card") was redesigned from scratch to earn its
name — beyond the existing Stage/Followup/Problem/Compatibility/Lead/Last
touch, it now surfaces Priority, the customer preferred channel, the primary
contact's email/phone, Current
solution, Interview date, Needs/tags, and quiet validation-notes/open-tasks
counts — real information the drawer never carried before, not just a
re-skin. **No Record button on the card** — Nima asked for it removed; the
footer is a single "Open customer page" CTA, since recording belongs to the
page/topbar/⌘K, not a quick-view popup) · **Customer and Contact are separate
entities.** A Customer is either `kind: "company"` (a business account,
optionally pointing at one Contact as its primary contact) or `kind:
"individual"` (a standalone person who is their own account, but still gets
their own, separately-stored Contact record — the two entities hold
different information and don't collapse into one just because there's a
1:1 relationship). `Contact.customerId` is optional, so a contact can exist
unassigned (picked later, or never). `/customers/new` and `/contacts/new`
are dedicated creation pages, not modals — company mode lets you pick an
existing unassigned contact or create one inline; individual mode auto-
creates the matching Contact from the same form. No backend yet, so
creation mutates the shared `fixtures.ts` arrays directly via
`createCustomer()`/`createContact()`; anything that looks up a record by id
must do it client-side (`customerById()` inside a `"use client"` component)
rather than in an async Server Component, or newly-created records 404 —
the server's module instance never sees a mutation the browser made ·
Contacts (lightweight people directory — name, role, email, phone, LinkedIn,
linked account if any) — no preferred channel, Stage, Compatibility, or Lead
duplication; preferred channel lives on the customer/account, and validation
state lives across Customers and Validation Progress. Each linked row opens
that account's Customer page · Library (ALL
recordings AND standalone written notes, customer-attached or
standalone — weekly meetings, learning notes, or a note with zero
recording behind it at all (`Conversation.noteBody`, created via the
"+ New note" composer — title, Topic, optional customer participants, body;
no separate workspace page for notes — viewed entirely through the
quick-view drawer); organized by **Topics**: user-created colored
collections with members and roles, carried over from the notes app's
Topics hub; lenses: Topics / Team feed = everything members shared, with
author chips / Mine. **Recordings and notes are separated on two axes now**:
an orthogonal content-type tablist ("All | Recordings | Notes") sits above
the lens content — picking Recordings or Notes hides the other type
entirely, a real filter, not just a label — and within "All", each
lens/Topic group still renders them as two separately labeled, separately
counted subsections (`library-view.tsx`'s `TypeGroup`), each using its own
from-scratch card component: `recording-card.tsx` (waveform-led, pipeline
detail row — open actions/decisions/chapters) vs. `note-card.tsx`
(topic-colored left edge, note icon in a circle, a 2-line body preview, a
reading-time estimate) — structurally distinct, not a shared row with an
icon swapped. Per-recording visibility private → shared.
Reassigning a recording's Topic is drag-and-drop between Topic sections,
same interaction language as dragging a Board row between segments. **Every
recording/note has a Linked customers and Linked contacts section**
(`linked-section.tsx`'s generic `LinkedSection` — removable chips + a
dashed "+ Add" dropdown), shown in both the drawer and the full Conversation
Workspace; the workspace header itself carries no customer name or "open
customer page" button anymore — that information moved entirely into the
Linked section so it isn't duplicated. **Participants, not a single owner**:
a conversation carries `participantIds`
(zero, one, or several customers) plus a separate `contactIds` (the actual
people, independent of which company-level accounts are attached) — not
every note is about a customer (weekly syncs, learning notes stay
first-class with zero), and one recording can span several accounts (a
pipeline review that touches two named customers). Every participant
customer sees the conversation in their page's
Conversations tab, and Cass can draw on it when scoped to that customer.
**Conversation Workspace** (/library/:id) carries the full notes-app
post-transcription kit: a real audio player (play/pause, waveform seek with
progress reveal, chapter marks + trace-anchor markers — not seek-only), stats
strip, navigable chapters, editable note brief with edited-by attribution,
action board (assignees are a real multi-select picker on the avatar stack,
due labels, open/done, source-trace chips), decisions + follow-ups with
transcript anchors, AI tag chips (keywords ≠ Topic collections), diarized
transcript (speaker names/colors, rename, low-confidence flags, corrections
stored beside originals), timestamped comments with a real composer (posts
anchor to the current playhead automatically, appears in the scrubber's
markers) and mentions, per-conversation Q&A with moment citations, export menu
(Google Docs / Microsoft Teams), external share link, visibility toggle, and
processing/failed pipeline states) ·
Work (one task center, urgency grouping, source chips) · Calendar (layered
ICS feeds, busy-only teammates, find-a-slot) · Insights (every number clicks
through to evidence) · Ask (Cass threads, scope chips) · Settings/Admin ·
Public: /intake, /share/:token.
