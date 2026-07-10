# GlaciaNav V2: Glacier Atlas

Glacier Atlas is a light navigational design system for relationship intelligence. It treats every customer, conversation, and task as part of one connected route. The interface should feel precise, spacious, and quietly capable.

## Design intent

- Light theme only. Snow-white work surfaces sit on a cool blue-gray canvas.
- Cobalt is the single brand accent. It marks active routes, primary actions, focus, and selection.
- Status colors are semantic and appear only where meaning depends on them.
- A continuous cobalt route line is the signature device. It anchors active navigation, priority cards, and key workflow moments.
- Density is operational, not cramped. Important objects use surfaces; supporting information uses spacing and sparse dividers.
- Motion is restrained to feedback and state transition.

## Foundation tokens

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--ice-0` | `#F4F7FB` |
| Recessed canvas | `--ice-1` | `#EAF0F7` |
| Primary surface | `--surface` | `#FFFFFF` |
| Secondary surface | `--surface-2` | `#F0F4F9` |
| Primary ink | `--ink` | `#14233A` |
| Secondary ink | `--ink-2` | `#43536B` |
| Quiet ink | `--ink-3` | `#6F7F95` |
| Structural line | `--line` | `#CBD6E4` |
| Soft structural line | `--line-2` | `#E2E9F2` |
| Cobalt action | `--melt` | `#275EE7` |
| Cobalt hover | `--melt-strong` | `#1848BD` |
| Danger | `--danger` | `#BA493F` |

Legacy token names remain as compatibility aliases while all components move to the V2 language.

## Typography

- Space Grotesk is the interface and display family.
- IBM Plex Mono is reserved for dates, counts, shortcuts, and compact system labels.
- Interface body text starts at 14 px with a 1.4 to 1.5 line height.
- Headings use close tracking and sentence case.
- Uppercase is limited to short utility labels with 0.1 em tracking.
- Numeric lists and tables use tabular lining figures.

## Geometry

- Controls: 10 px radius.
- Small containers: 12 to 14 px radius.
- Panels and drawers: 16 to 20 px radius.
- Pills are reserved for statuses, filters, avatars, and other genuinely compact metadata.
- Cards use a soft border and blue-tinted shadow. Hard offset shadows are not part of V2.

## Layout

- Desktop uses a 260 px light navigation rail and a 72 px utility bar.
- Main content is capped at 1600 to 1680 px with 20 px mobile, 28 px tablet, and 40 px desktop gutters.
- Mobile uses a five-slot bottom navigation. Secondary destinations open in a full-width sheet.
- Dense desktop tables may scroll horizontally, but primary actions and filters reflow before content is clipped.
- Drawers preserve an 8 to 12 px viewport margin on every device.

## Components

- Primary buttons: cobalt with white text.
- High-contrast neutral actions: ink with white text.
- Secondary controls: white or soft-gray surface with a structural border.
- Active navigation: pale cobalt fill, cobalt icon and type, and the route-line anchor.
- Cards: white surface, soft edge, and minimal elevation.
- Inputs: visible labels, cool recessed fill, structural edge, and cobalt focus.
- Empty states: short direction plus one relevant action.

## Interaction

- Hover transitions last 160 to 180 ms.
- Pressed controls move down by 1 px.
- Menus and dialogs enter in 150 to 220 ms with opacity and transform only.
- Reduced-motion preferences collapse all nonessential animation.
- Every pointer target is at least 44 px where the layout permits.

## Accessibility

- Focus uses a 2 px cobalt outline with 3 px offset.
- Text and controls meet WCAG AA contrast.
- Status is never communicated by color alone.
- Navigation exposes `aria-current`; dialogs and drawers trap focus and close with Escape.
- Mobile navigation respects the safe-area inset.
