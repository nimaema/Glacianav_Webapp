---
version: alpha
name: Aurora Chart
description: A light, precise workspace instrument for customer validation.
colors:
  primary: "#3D6FA6"
  on-primary: "#FFFFFF"
  surface: "#FFFFFF"
  surface-muted: "#F2F4F9"
  text: "#17202B"
  text-muted: "#4B5566"
  line: "#DDE3EE"
  nova-interactive: "#0E8C7F"
  nova-action: "#0A6B61"
  on-nova-interactive: "#FFFFFF"
  danger: "#C0463A"
typography:
  ui-body:
    fontFamily: Bricolage Grotesque
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.4
  ui-label:
    fontFamily: JetBrains Mono
    fontSize: 0.625rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.12em
rounded:
  card: 16px
  control: 11px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: 12px
  surface-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: 16px
  recessed-control:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.control}"
    padding: 12px
  subtle-rule:
    backgroundColor: "{colors.line}"
  nova-focus:
    backgroundColor: "{colors.nova-interactive}"
  nova-action:
    backgroundColor: "{colors.nova-action}"
    textColor: "{colors.on-nova-interactive}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.pill}"
    padding: 12px
  destructive-action:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.control}"
    padding: 12px
---

# GlaciaNav Workspace — design system: "Aurora Chart"

Aurora Chart treats customer validation as a synoptic instrument: a chart you
read at a glance, precise, luminous, calm. It replaces both "Firn" (light
glacial paper) and "Northstar" (dark editorial rail) with a single, strictly
**light-first** system — there is no dark surface anywhere in the app,
including the rail, the topbar, and the login screen.

This file is the gate: no UI ships that violates it.

## 1. Core expression

- The whole app is light. The shell (rail + topbar) is not distinguished from
  content by darkness — it reads as a distinct zone through a hairline border
  and a subtle tonal shift (`--shell` vs `--page`), nothing more. This holds
  everywhere, including Nova's Wing (§7c) — there is no dark surface anywhere.
- Validation stages get a literal meteorological glyph system: Interview is a
  cold front, Review is a warm front, Decision is an occluded front, Signed is
  a high-pressure system. This is the one deliberate hand-rolled-icon
  exception in the whole app, scoped narrowly to Stage — Compatibility,
  Priority, Problem, and Followup stay flat-tint pills, never glyphs.
- One flat accent color carries every interactive affordance: buttons,
  links, active nav/tab states, focus rings, checkboxes. There is no second
  "highlight" color layered on top of it.
- A restrained aurora gradient (teal → violet → rose) exists purely as
  atmosphere in exactly two places app-wide — never as a functional signal.

## 2. Tokens (source of truth: `src/app/globals.css`)

Surfaces: page `#F7F9FC` · page-2 `#EEF1F7` · surface `#FFFFFF` · surface-2
`#F2F4F9`. Text: ink `#17202B` · ink-2 `#4B5566` · ink-3 `#7C8698`. Hairlines:
line `#DDE3EE` · line-2 `#E8ECF4`. Shell: `#FFFFFF` / `#F5F7FB` (the rail and
topbar are a light zone, not a dark one).

**Accent** `#3D6FA6` (+ strong `#2C527E`, soft 12% tint) — the single
interactive color. **Danger** `#C0463A` — destructive actions and errors
only, never reused for anything else.

**Aurora** (decorative only): teal `#14B8A6` · violet `#6366A8` · rose
`#C77DA0`.

**Weather-front glyphs** (Stage only): cold `#2F6FB0` · warm `#D1614A` ·
occluded `#7A5FB0` · high-pressure `#2F9E63`.

**Data palette** (segments, topics, owners, feeds, speakers — user content,
never chrome): cyan `#1F95A8` · green `#2F9E63` · violet `#6F5FB0` · coral
`#D1614A` · blue `#3D6FA6`.

**Color rules**
- Accent is the only brand-interactive color and always means *clickable*.
- The data palette belongs to user content (stage ticks, tags, owners,
  calendar feeds, avatar/topic/speaker colors). Chrome never uses data colors.
- Weather-front colors belong to Stage alone — never repurposed as a general
  5th data-palette slot.
- Destructive actions always wear `--danger`, never the accent color.
- Colored marks always carry a visible text label or a distinct shape
  alongside color (compatibility badges keep both a dot and a label;
  weather-front glyphs are shape-distinct from each other, not just
  color-distinct) — color is never the only signal.

## 3. Geometry and materiality

- Cards: 16px radius (`--radius-card`). Controls/inputs: 11px
  (`--radius-control`). Tags, pills, avatars: full pill (`--radius-pill`).
  This is a real departure from the old squared 4-8px "firn" scale — pick
  one radius per element category and hold it everywhere.
- `.surfaced` / `.surfaced-lg` — white card, hairline border, soft ambient
  shadow (`0 10px 24px -18px rgba(23,32,43,.18)`, never a hard offset
  shadow).
- `.recessed` — a flat `--surface-2` tonal fill for inputs and nested
  content. There is no left-border-accent convention anymore — recessed
  content is a plain tint, nothing more.
- `.rise-on-hover` / `.risen` — the same lift concept as before (translateY,
  deepening shadow), just softer.
- **Fixed-pixel data grids are an explicit exception.** Board, Kanban, Work's
  task table, and Calendar's week grid all depend on exact inline pixel math
  (fixed column widths, 56px-per-hour row height, greedy lane-packing) that
  predates this system and must not change. Redesign their colors/radii/
  shadows freely; never touch their `gridTemplateColumns`, row-height
  constants, or drag-and-drop wiring.

## 4. The weather-front glyph system

Four small hand-drawn SVG glyphs (~12-20px, single-color stroke, no fill
except the high-pressure circle), always paired with the Stage label they
represent:

- **Cold front** (Interview) — a row of inward-pointing triangle spikes.
- **Warm front** (Review) — a row of semicircle bumps.
- **Occluded front** (Decision) — alternating spikes and bumps.
- **High-pressure** (Signed) — a plain circle.

This system is Stage-only. It must never spread to Compatibility, Priority,
Problem, Followup, or any other semantic scale — those stay flat-tint pills
so the glyph language keeps its meaning.

## 5. The aurora restraint layer

The soft teal → violet → rose radial wash is allowed in exactly **two**
spots app-wide: the page-header band (`.aurora-wash`, via `PageHeader`), and
the Nova/brand mark (the rail's concentric pressure-ring glyph and Nova's
avatar/closed-state trigger). It is always layered over a solid `--surface`
or `--page` base so text-contrast math is computed against that solid color,
never against the gradient itself.

**Never:** on buttons, active nav or tab states, borders, focus rings, or as
a text-gradient. If a third spot feels tempting, that's a sign the restraint
is being diluted — reach for a plain tonal fill (`--page-2`/`--surface-2`)
instead.

## 6. Components

- Primary buttons: solid `--accent` fill, white text (or white fill with
  `--accent` text for secondary emphasis).
- Secondary controls: hairline outline, no shadow.
- Cards: `.surfaced` — white, hairline border, soft ambient shadow.
- Pills: full-pill, tinted-background + colored-text chips, mono labels kept
  for data density (counts, timestamps, short codes).
- Focus: 2px solid `--accent` ring, 3px offset.
- Dialogs/drawers: neutral ink-based scrim (no more teal-tinted "petrol"
  scrim), same focus-trap and Escape/outside-click behavior as before.

## 7. Motion

- Interaction transitions last 150-180ms.
- Action surfaces lift 2px on hover with a deepening ambient shadow — no
  hard-offset "brutalist" shadow snapping.
- The audio waveform's `.wave-bar` pulse and the recording REC dot are the
  only looping decorative motion in the app; nothing else loops.
- Nova's loops are state-conveying, not decorative: the orb's gradient
  drift, the mark's breathe, and the thinking dots run ONLY while a
  request is actually in flight. Idle, Nova is perfectly still.
- Reduced-motion preferences collapse every transition and animation.

### 7b. Nova's identity

Nova's mark is a four-ray star with her initial woven into its core as
a small monogram N (`nova-mark.tsx`) — hand-rolled SVG, permitted as
part of the brand-mark exception alongside the rail's pressure-ring
glyph. It wears the aurora gradient (§5). Two render tiers: the plain
star+N (used at the ~13-15px it renders at inline in trace kickers,
where a busier mark turns to mud) and a `detailed` tier that adds a
dashed orbital ring + four diagonal accent dots (sky band 36px, closed
orb 26px, where there's room to read it). `busy` slow-spins the ring
and pulses the dots — state-conveying only, while a request is
actually in flight (§7), same restraint as the spine's comet.

### 7c. Nova's Wing

Nova is not a floating chat card: she is a **full-height wing that
sweeps in from the right edge** of the instrument (`.nova-wing`,
fixed inset-y-0 right-0, 600px on desktop, full-width on mobile),
light and pearlescent like the rest of the app. She has her own scoped
token set (`--nw-*` in `globals.css`): near-white surfaces
`#FCFDFF / #F3F6FC / #E9EEF8`, ink text, and **deep teal `#0E8C7F` as
Nova's own interactive color** — send, links, focus, next-move chips;
the app's flat blue never appears inside the wing, and the wing's
tokens never leak back out. Tone palette (all AA-grade on white):
violet `#5D5FC7`, rose `#B85F8E`, green `#1F9D5C`, coral `#C05430`,
gold `#9C7311`.

**The sky band.** The wing's header is Nova's sanctioned aurora spot
(§5) at full pearlescence — mother-of-pearl washes over white
(`.nova-wing-sky`), with her mark large and a display-size "Nova"
wordmark. On open, a single white sheen sweeps across it once as part
of the entrance; idle, the sky is still.

**The spine.** The conversation is a **trace, not a bubble chat**: an
aurora-gradient thread (`.nova-spine`) draws top-to-bottom on open and
every exchange pins to it as a node — hollow ports for the user's
entries, Nova's star for her readouts. Entries carry mono
"YOU / NOVA · HH:MM" kickers. The two voices are visually distinct:
**queries are input**, so they sit in a recessed `--nw-bg-2` tinted
block (plain tint, §3 — no accent edge) with a teal-deep kicker;
**Nova's readouts print straight on the paper** under her star. No
colored bubbles, no per-message avatars. The `Entry` node component
and any list rendered while typing MUST live at module scope, never be
defined inside `NovaDock`'s render body — a fresh function identity on
every keystroke makes React treat every entry as a new component type
and remount the whole trace, replaying every entrance animation.

**Signal chips.** The empty state's opening entry closes with a row of
tappable pills (`SignalRow`) — a live account, an open-task count, an
evergreen action — each with its own icon and tone color, not a
vertical list of suggested sentences to read. They're real workspace
signals that happen to be askable, not a canned FAQ.

**Motion choreography** (all state- or entrance-conveying, §7; reduced
motion collapses everything): the wing sweeps in (340ms), the spine
draws (600ms), sky contents and entries rise in a stagger; headlines
resolve blur→sharp (`.anim-resolve`); while a request is in flight a
**comet travels the spine** and shimmer lines stand where the readout
will land; the next-move chip pulses its teal glow exactly once when
it appears. Nothing loops while idle.

**Structured answers.** Substantive readings arrive as typed blocks
(`nova-blocks.ts` protocol, composed by the agent's `present_answer`
tool, rendered by `nova-answer-blocks.tsx`), rising in a stagger on
the newest reply — deliberately NOT a stack of identical bordered
cards; the **callout is the one boxed surface**, spending the "card"
treatment on the single thing meant to stand out, everything else
reads as marks directly on the paper: a display-weight one-line
headline; a **stat readout strip** (colored mono numbers in a single
row, divided by hairlines, like an instrument reading out several
channels — no per-number box); a **table** for 3+ records sharing the
same fields (white card — a grid structurally needs its frame, that's
containment not emphasis; mono-caps header band on `--nw-bg-2`,
hairline rows, right-aligned tabular-numeral numeric columns, cells
tone-colorable via a "tone:" prefix so status columns read at a
glance) — comparison belongs in a table, never a list; **entity rows**
(a short aurora tick,
title, the-one-thing-that-matters subtitle, mono meta separated by
dots) in a plain hairline-divided list, no enclosing card; **task
rows** (checkbox squares, who/due in mono) headed by a small radial
progress ring when there's more than one; **distribution bars**
(one measure across categories per §9's proportional-bar rules —
flat tinted pill fills scaled against the max, never past roughly
half the row, always paired with the mono count); a **trend
sparkline** (§9's meteogram language in miniature: 2px teal stroke
over a ≤8% area fill, white station-plot points, the newest point
filled with a soft halo — only ever drawn from real tool-result
series); a **timeline** (the trace language in miniature: a hairline
mini-spine with filled tone ticks for what happened and hollow ports
for what hasn't); at most one **verbatim quote** (the customer's
exact words printed on the paper in real curly quotes with a tone
tick and mono attribution — evidence never hides in a box); at most
one **callout**
(info=teal, win=green, warn=gold, risk=coral — tinted white panel,
colored icon kicker); at most one **choice route** (an unboxed branch
list with compact 44px-minimum rows, tone-tinted route fields, numbered
keyboard shortcuts, and single-send or multi-select behavior; desktop
descriptions clamp to one line, mobile descriptions to two, and exact/min/max
selection rules are announced and enforced by the control); at most one **inline input**
(text/date as a recessed answer bar, number as a minus/value/plus stepper); one
**bounded scale** (a colored slider for a continuous-feeling quantity or 2–10
segmented steps for a rating); one **conversational confirmation** (compact
confirm/decline rail for low-risk choices only — signed destructive confirmations
stay separate); and at most one **next-move chip** (solid teal
pill, tap sends its prompt back to Nova) which replaces the prose
closing offer. Every titled block opens with the same kicker (short
tone dash + mono caps label), the voice of the trace's own entry
kickers. Tones carry meaning (green=healthy, coral=problem,
gold=watch), never decoration. Tool runs print as mono trace lines
with green/red state icons; files are format-colored artifact cards;
destructive confirmations are danger-tinted rails with an explicit
Confirm / Keep it choice. Plain markdown remains the fallback for
quick facts and casual turns. The empty state is a briefing — live
workspace numbers as a stat readout plus signal chips (above) derived
from real data, never canned copy.

## 8. Typography and copy

- Bricolage Grotesque is the display and UI voice; JetBrains Mono is the
  data voice (timestamps, counts, stats, short codes).
- Body text is at least 14px, primary interface text at least 15px — the
  readability floors this app already fought for stay in force.
- Sentence case for actions and prose. Uppercase is reserved for short,
  letterspaced system labels (section labels, pill text).
- Copy is direct, specific, and active. No decorative slogans or fabricated
  data.

## 9. Chart language

Data on this instrument is drawn the way a meteogram is: quiet paper,
precise plotting.

- Grid: thin `--line-2` horizontal rules with mono y-labels; no boxes
  around plot areas beyond the section's own `.surfaced` panel.
- Series: flat `--accent` stroke (2-2.5px) over a very faint accent area
  fill (≤8% opacity). Plotted points are station-plot circles — white fill
  with an accent stroke — and the current period is the one filled point,
  with a soft halo ring.
- Reference lines (targets, thresholds): dashed ink, labeled in small
  mono caps at the *left* end of the line, away from the newest data.
- Axis and data labels: JetBrains Mono, tabular numerals.
- Proportional bars (funnel, topics, workload): flat tinted fills with a
  rounded-full right end, always scaled against the section's max value
  and always paired with the mono count — the bar is a visual aid, the
  number is the datum. Bars never exceed roughly half the row so labels
  and counts stay dominant.
- Empty measurement is stated, not decorated: a `recessed` panel with a
  plain sentence and one CTA, never a fabricated flat-zero chart standing
  in for missing data.

## 10. Accessibility

- All interactive controls have visible focus and a 44px target where
  practical.
- Information never depends on color alone — weather-front glyphs are shape-
  distinct, compatibility badges carry both a dot and a label.
- Text contrast meets WCAG AA against both `--page` and `--surface`
  backgrounds, including white text on the `--accent` fill used for buttons
  and active states.
- The aurora wash stays subtle enough (or sits behind a solid enough base)
  that it never drags header text below AA contrast.
- Reduced-motion preferences collapse transitions and animations.
