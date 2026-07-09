# GlaciaNav — Northstar design language

Northstar treats customer research as fieldwork: precise, active, and grounded in evidence. The interface combines a dark operational frame with light editorial work surfaces. It should feel like a contemporary field console, not a generic SaaS dashboard.

## Core expression

- The shell is deep forest-black. Content is warm mineral-white.
- Mineral lime is reserved for active navigation, primary actions, focus, and selection.
- Geometry is squared: 0–8 px radii, visible structural rules, and occasional offset shadows.
- Hierarchy comes from scale, spacing, and contrast. Cards are used only for actionable objects.
- Display typography is large, tight, and left aligned. Mono type marks time, counts, scopes, and system labels.

## Tokens

- Deep `#111813`; deep raised `#1C261E`
- Paper `#F6F7F1`; field `#E5E7DF`; recessed `#ECEEE6`
- Ink `#172019`; secondary `#4A554C`; quiet `#6B766D`
- Action green `#355C32`; signal lime `#D7F35B`
- Structural rules `#C8CEC4` / `#D9DDD5`

The existing token aliases in `src/app/globals.css` remain for component compatibility, but these Northstar values are the source of truth.

## Layout

- Desktop uses a 248 px dark rail and an 80 px utility bar.
- Page content is capped at 1680 px with 24–40 px horizontal gutters.
- Home uses a 12-column editorial grid: eight columns for active work, four for ambient context.
- Page headers are full-width identity zones with fluid display type.
- Mobile collapses the rail and stacks the editorial grid without shrinking tap targets below 44 px.

## Components

- Primary buttons: signal lime on deep ink, or deep ink on paper.
- Secondary controls: structural outline with no floating shadow.
- Action cards: mineral paper, 1 px structural edge, 4–7 px offset shadow.
- Secondary modules: open layout with a single rule, not a container around every group.
- Pills: compact mono labels with squared edges and semantic color plus text.
- Focus: 2 px signal lime with 3 px offset.

## Motion

- Interaction transitions last 150–180 ms.
- Action surfaces may move up and left by 2 px while their offset shadow expands.
- First-load content enters with a short stagger only when reduced motion is not requested.
- No looping decorative motion.

## Typography and copy

- Schibsted Grotesk is the display and UI voice; Spline Sans Mono is the data voice.
- Body text is at least 14 px, primary interface text at least 15 px.
- Display type uses fluid sizing and tight tracking; body copy is limited to 70 characters where possible.
- Sentence case for actions and prose. Uppercase appears only in short, letterspaced system labels.
- Copy is direct, specific, and active. No decorative slogans or fabricated data.

## Accessibility

- All interactive controls have visible focus and a 44 px target where practical.
- Information never depends on color alone.
- Text contrast meets WCAG AA.
- Reduced-motion preferences collapse transitions and animations.
