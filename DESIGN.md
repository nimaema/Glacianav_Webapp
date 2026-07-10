# GlaciaNav V2: Editorial Command Desk

GlaciaNav V2 is a structural redesign, not a restyled version of the previous workspace. The interface is organized like a working editorial desk: a global command dock, a narrow operating strip, open work zones, ruled lists, and strong typographic hierarchy.

## Product idea

Customer work is rarely a set of isolated cards. It is a changing brief made of conversations, commitments, evidence, and next actions. V2 keeps those relationships visible by arranging information in continuous work zones rather than a dashboard full of containers.

## Architecture

- The old 260 px sidebar is removed.
- Desktop navigation is a 68 px horizontal command dock. Every primary workspace is visible from every page.
- A separate 54 px operating strip holds global search, creation, notifications, and account controls.
- Mobile uses a fixed five-slot command bar with a full-width secondary desk sheet.
- Page headers use an asymmetric two-column composition: identity and context on the left, live counts and actions on the right.
- Home uses a full-width priority band followed by editorial work columns.
- Repeated content uses ruled rows and open space. Raised cards are reserved for overlays and menus.

## Visual language

The direction combines editorial composition with industrial utility. It borrows the clarity of printed field manuals and the directness of control-room labels without imitating either literally.

- Light theme only.
- Warm mineral canvas and paper-white work surfaces.
- Deep pine is the action color.
- Acid chartreuse marks active navigation, priority work, selection, and focus.
- Geometry is nearly square: 0 to 2 px for controls and work surfaces.
- Pills remain only for compact status metadata and avatars.
- Shadows appear only on overlays, menus, and the floating Nova trigger.
- Fine vertical grid lines create continuity across long work canvases.

## Foundation tokens

| Role | Value |
| --- | --- |
| Canvas | `#F1F0EA` |
| Recessed canvas | `#E5E6DF` |
| Work surface | `#FBFAF5` |
| Recessed surface | `#E9EAE3` |
| Primary ink | `#16221D` |
| Secondary ink | `#46534D` |
| Quiet ink | `#707A73` |
| Structural line | `#C8CBC2` |
| Action pine | `#1E5B4C` |
| Active signal | `#D9EB4B` |
| Danger | `#A63E32` |

## Typography

- Newsreader is used for page identity, priority titles, and editorial section headings.
- Archivo is used for interface text, labels, controls, and data.
- UI text is 14 to 16 px with a 1.42 to 1.5 line height.
- Display type is compact and deliberately large only where it establishes page identity.
- Uppercase is limited to short operating labels with 0.1 em tracking.
- Numeric data uses tabular figures.

## Component grammar

- Primary buttons use deep pine or near-black with light text.
- Priority actions may use chartreuse with dark text.
- Secondary actions use transparent backgrounds and ink borders.
- Work surfaces use one structural border and no ambient shadow.
- Lists use shared rules instead of individually boxed rows.
- Empty states are integrated into the work zone and include one clear next action.
- Dialogs and drawers use hard edges and a strong ink outline.
- Nova is a small chartreuse instrument with a hard offset shadow.

## Responsive behavior

- Mobile gutters: 20 px.
- Tablet gutters: 28 px.
- Desktop gutters: 40 px.
- Multi-column page headers become stacked compositions below 1024 px.
- Dense tables either become labeled rows or use contained horizontal scrolling.
- Touch targets are at least 44 px.
- Mobile navigation respects the safe-area inset.

## Motion

- Hover feedback: 150 ms.
- Menus: 250 ms.
- Drawers: 300 ms.
- Only opacity and transform animate.
- Repeated work rows shift horizontally by 2 px on hover to signal direct manipulation.
- Reduced-motion preferences remove all nonessential movement.

## Accessibility

- Focus uses a 3 px chartreuse outline with a 2 px offset.
- Text and controls meet WCAG AA contrast.
- Status is never communicated by color alone.
- Navigation exposes `aria-current`.
- Dialogs and drawers trap focus and close with Escape.
- The primary work canvas has a stable `main-content` landmark.
