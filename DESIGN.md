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
  and a subtle tonal shift (`--shell` vs `--page`), nothing more.
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

Nova's mark is a four-ray stellar nova with a tilted orbital ring
(`nova-mark.tsx`) — hand-rolled SVG, permitted as part of the brand-mark
exception alongside the rail's pressure-ring glyph. It wears the aurora
gradient (§5).

Nova's panel is an **observation log, not a bubble chat**. The user's
queries sit in recessed input blocks (`.recessed` — queries are input)
under a mono "YOU · HH:MM" kicker; Nova's replies are readouts printed
straight on the white paper under her mark and a mono "NOVA · HH:MM"
kicker; exchanges are separated by hairline rules. No colored chat
bubbles, no per-message avatar orbs — the aurora stays on the mark and
the closed-state orb only. Markdown renders fully (headings, tables,
task lists, one callout max), tool runs print as mono log lines with a
green/red state icon, generated files show as format-colored artifact
cards with a download affordance, and destructive confirmations are
danger-tinted cards with an explicit Confirm / Keep it choice. The
empty state is a briefing, not a greeting: real workspace numbers and
prepared queries derived from live data, never canned suggestion pills.

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
