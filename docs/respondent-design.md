# Respondent redesign — Field atlas

Audience: invited research participants. Job: understand and answer a rich questionnaire confidently, without feeling like they are filling in an administrative database form.

## Direction explored

The first option was a centered conversational card with one question per screen. It is visually simple, but would impose a presentation mode on existing questionnaires and still resemble a standard form template. Rejected.

The selected direction is an editorial field atlas: an asymmetric reading surface with a section route beside it. GlaciaNav's navigation/research context informs the contour illustration, route checkpoints, instrument-like numeric scales, and ordered ranking lanes. Section counts, checkpoints, and progress encode actual form state; no fabricated metrics or unrelated stock imagery.

```text
GlaciaNav / Questionnaires                         Private response
──────────────────────────────────────────────────────────────────
Questionnaire title                              Contour illustration
Description                                      Question / section count
──────────────────────────────────────────────────────────────────
YOUR ROUTE                  SECTION / TITLE
01 Getting started          01 Question title                    Required
02 Your perspective         [ A Choice tile ] [ B Choice tile ]
                            [ C Choice tile ] [ D Choice tile ]
Progress / saved state      02 Ranking lanes / matrix / custom inputs
Privacy                     Back                     Continue →
```

Mobile: the route becomes a compact horizontal chapter strip, controls stack where needed, matrix rows become labeled selector groups, and navigation remains in document flow. No fixed footer obscures the keyboard or long answers.

## Tokens and visual signature

- Snow `#F7F9FC`, paper `#FFFFFF`, frost `#EEF1F7`, ink `#17202B`, muted ink `#4B5566`, instrument blue `#3D6FA6`.
- Bricolage Grotesque for large editorial titles and 16 px body/control labels. JetBrains Mono for small section markers, question ordinals, counts, and scale readouts. No new font request.
- 16 px answer-tile radius, 11 px input radius, wide 1160 px respondent composition, 280 px desktop route column. Scoped styles do not change the authoring dashboard.
- Signature: a code-native, static contour relief in the intro and a true section/checkpoint route. The relief is atmospheric illustration, not a purported data map. It has no labels suggesting real measurements.

## Implementation boundary

Replace the SurveyJS visual renderer, not the schema or persistence layer. Use Survey Core headlessly for visibility, carried choices, and page state; keep the same server validation and autosave protocol. Build every visible question control in application React/CSS with native semantic input primitives. Shared forms, previews, and read-only response inspectors use the same custom controls. Keep published definitions and existing answers unchanged.

## Acceptance

Verify all 23 palette entries have a custom renderer, required and hidden answers behave correctly, ranking has touch/keyboard alternatives, file selection/upload works, question/page/single modes preserve navigation, review and submission remain separate, and responsive screens have no root overflow. Retest existing HTTP lifecycle and engine tests. Visually inspect actual desktop and mobile browser screenshots.
