# Questionnaire app: implementation and operations

Status: working local implementation, 11 September 2026. This is not yet a production release. The broader product specification is in [questionnaire-app-plan.md](questionnaire-app-plan.md); that document includes requirements beyond this implementation. The differences and remaining acceptance work are listed below.

## Try it locally

```sh
npm ci
npm run dev:questionnaires -- --port 3100
```

Open `http://127.0.0.1:3100/questionnaires`. This intentionally works without Supabase, SMTP, or Docker. It only activates in development, on loopback, with `QUESTIONNAIRE_LOCAL_PREVIEW=true` and **no `DATABASE_URL`**. The command sets the preview flag and loopback binding. If a database URL is configured, use the connected-workspace setup instead; this command will not silently replace that database.

The preview has a clearly labeled local identity and persistent PGlite storage under `.questionnaire-preview/database`; attachments are under `.questionnaire-preview/assets`. Both are ignored by Git and Docker. Restarting preserves your work. Back up this directory while the preview server is stopped if you want to keep a local study. Local data is not synchronized to Supabase. It is not an encrypted production data store; use synthetic data here.

Email is disabled, CRM contacts are not fabricated, and upload scanning is bypassed **only** in this isolated development mode. Other modules in the site still require their normal services. Personal links beginning with `127.0.0.1` only work on this Mac: do not send them to external respondents.

Local browser QA left a Field research questionnaire with a clearly labeled synthetic response from `QA Browser Tester` / `browser-test@example.test`. Automated fixtures are archived after each successful or failed lifecycle run. These are test data, not research findings.

## What works

### Authoring and presentation

- Questionnaire library with blank creation, three starting templates, search, draft/published/archived filters, duplication, archiving, and restoration.
- A seven-section workspace: Overview, Build, Logic, Share, Responses, Results, and Settings.
- Section-based visual builder with question palette, option editor, paste-one-option-per-line, stable IDs, duplication, reordering, moving questions between sections, and editable descriptions.
- Autosaved drafts with revision checks, visible saving/error states, undo/redo, and publishing validation. Concurrent stale writes return a conflict instead of overwriting another draft.
- Immutable published versions. Each collection is pinned to one version; changing or republishing the draft cannot alter an existing recipient's questions.
- Section and question visibility conditions, all/any groups, conditional requiredness, and selected-option carry-forward from earlier choice questions. Invalid forward references cannot publish. Hidden answers are discarded on the server, not counted as genuine answers.
- Paged, all-on-one-page, and one-question-at-a-time modes; progress, review-before-submit, configurable completion copy, and preview without collected responses.
- Aurora-aligned UI using the site's Bricolage Grotesque/JetBrains Mono typography, light surfaces, blue accent, deliberate spacing, responsive layouts, focus states, and reduced-motion styling. The frontend, design-engineering, typography, responsive, and React-performance skills informed these choices.

The preview and shared questionnaire use the **same application-owned React renderer and definition**, not separate simplified forms. Survey Core is the headless logic engine; none of its stock form widgets or visual theme are used. No paid SurveyJS Creator component is used; the builder is application code.

The respondent interface uses the Field Atlas design: custom contour artwork, an editorial invitation, a section route with real progress, and individually designed controls for every question type. These include choice/image tiles, searchable disclosures, rating bars, sliders with exact entry, number steppers, ranking lanes with keyboard reorder actions, mobile-stacked matrix rows, writing panels, acknowledgments, and attachment cards. Review and confirmation screens share the same visual system. The custom renderer preserves seeded choices, conditional visibility/requiredness, carry-forward, autosave, file ownership, and server-side validation. `form-model.ts` gives question-at-a-time mode real pages so saved positions and navigation remain aligned with Survey Core 3.

| Available controls                                                | Shared and reporting behavior                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Short text, long text, email, phone, URL, date, time              | Appropriate input controls; lengths and supported formats validated; original values in review and export                                |
| Single choice, multiple choice, dropdown, searchable multi-select | Real selection controls, Other text, exclusive None, selection limits where supported, optional shuffled choices; counts and percentages |
| Yes/no, rating, NPS, slider, number                               | Explicit unanswered state, numeric bounds/steps where configured, scale controls and summaries; fixed 0–10 NPS calculation               |
| Ranking                                                           | Drag-to-rank and a button-based alternative; exact order, average rank, first-place count                                                |
| Rating matrix, checkbox matrix                                    | Actual row/column inputs, stacked mobile rows, required-row validation, per-row result distributions                                     |
| Image choice                                                      | Selectable image tiles from HTTPS URLs; labels and counts                                                                                |
| File upload                                                       | Private attachments, accepted extensions, size/count limits, server ownership checks, authorized downloads                               |
| Consent                                                           | Unchecked affirmative acknowledgment; versioned statement in the definition and timestamped submission                                   |
| Content                                                           | Escaped heading/text and optional HTTPS image/audio/video; no invented response                                                          |

There are 23 palette entries including the content block. The table groups related entries; it does not imply every variation described in the original plan is already configurable.

### Sharing and responding

- Named collections tied to published versions, optional deadlines, open/closed collection state.
- Select real CRM contacts in a connected workspace, add named individuals manually, or import CSV/XLSX with `Name` and `Email` columns. The first worksheet is used; duplicate emails in a collection are ignored and reported.
- Separate high-entropy personal links, stored as hashes. Manual links are shown at creation and can be copied. Generating a replacement link invalidates the old credential and existing respondent sessions.
- Optional Resend invitation delivery, scheduled sending, one configurable automatic reminder, manual reminders with a 24-hour throttle, delivery states, and bounce/complaint suppression. Manual reminders generate replacement links; previously queued reminders are cancelled.
- Durable encrypted outbox, lease-based claiming, provider idempotency keys, up to six attempts, bounded retry delay, and cancellation when a response is submitted/declined or its collection is closed. Queued links are cleared from sent/cancelled/finally failed payloads.
- Signed, idempotent webhook processing that retains receipts arriving before the provider send response. Bounce/complaint suppression cannot be overwritten by a later delivery receipt.
- GET of an invitation does not consume it or start a response. An explicit action creates the response/session; respondent cookies are HttpOnly, SameSite=Strict, and Secure in production.
- Save-and-return, autosave, conflict detection, retry feedback, server-side validation, idempotent submit, receipt, decline, revocation, and explicit reopening.
- Submission snapshots are retained. Reopening moves the current response back to draft, temporarily excluding it from submitted-only analytics until resubmission. Earlier submissions remain visible in the individual history; this differs from the plan's proposed “latest accepted submission until replacement” reporting behavior.

### Results and workspace integration

- Individual response review with all sections, attached files, internal notes, and submission history.
- Results filtered by published version, collection, segment, person search, submission date lower bound, and answer search; optional inclusion of drafts is clearly labeled.
- Choice counts/percentages, numeric mean/median, NPS, rankings, per-row matrices, text responses, and attachment lists. Skipped, unanswered, false, and zero are distinct. Multi-select percentages use people answering the question and may exceed 100% when summed.
- CSV/XLSX export of filtered responses, stable question/option IDs, answer states, and a workbook codebook. Spreadsheet formula prefixes are escaped in exported response text. Basic per-person PDF tables are also available; see PDF limitations below.
- Server-enforced owner/admin, editor, sender, and analyst access. Editors do not automatically see raw responses; senders manage invitations without raw-answer access; analysts can review/export but cannot edit or invite. Owners/admins manage collaborators.
- Questionnaires in site navigation/command search. On connected-workspace submission, an owner notification and a linked customer activity are created where applicable.

## Architecture and data protection

The feature is isolated under `src/lib/questionnaires`, `src/components/questionnaires`, questionnaire route groups, and questionnaire APIs. `types.ts` owns the editable definition, `engine.ts` translates and validates it, `service.ts` handles workspace operations, `respondent.ts` enforces sessions/submissions, and `analytics.ts` derives results. Heavy renderer/export modules are loaded on demand.

`src/db/migrations/0003_questionnaires.sql` creates 13 additive tables for questionnaires, immutable versions, access, campaigns, invitations, responses, accepted response revisions, sessions, assets, audit events, outbox, webhook receipts, and rate limits. The migration can be run repeatedly. Drizzle declarations are also exported from the main schema so schema introspection recognizes these tables.

The tables have RLS enabled with no browser-client policies. Access is through an authorized server service using the trusted database connection. The application is a single-workspace system, not a multi-tenant isolation layer. Production database grants must preserve this boundary.

Private operations check the active workspace profile and questionnaire role on the server. Respondent operations require the session belonging to that response and recheck deadline/collection/invitation state. Save transactions coordinate collection, invitation, and response locks to serialize against closure, revocation, and reopening. JSON validation rejects unknown question IDs, unsupported values, foreign file references, and stale revisions.

Public routes are narrowly exempted from workspace sign-in, never from respondent authorization. They set no-referrer, no-index, no-sniff, and private cache headers. Personal URLs remain bearer credentials: anyone receiving a forwarded link can use that invitation. There is no email OTP or identity proof. Ensure proxy/access logs redact `/q/*` credentials, avoid third-party tracking on these routes, and explain named-response privacy to recipients. External media hosts still receive ordinary media requests.

Uploads go through authenticated handlers to a private `questionnaires/` storage prefix. They are extension-allowlisted, checked against content signatures where applicable, scanned with ClamAV in connected environments, and downloaded as attachments. Unknown or unavailable scanner results fail closed. Local preview files are deliberately unscanned.

## Connected workspace and production activation

Do not deploy before completing the release blockers below. This implementation has not migrated or changed a production database, sent actual invitations, or deployed a container.

1. Configure normal Supabase authentication, linked active profiles, `DATABASE_URL`, and the canonical HTTPS `SITE_URL`. Verify sign-in before turning on `AUTH_REQUIRED=true`. Never enable local-preview/dev-profile bypasses in a deployed environment.
2. Back up the existing database. From a checkout with dependencies installed and a migration-capable direct database connection, set `DIRECT_URL` securely in the environment or `.env.local`, then run:

   ```sh
   npm run db:questionnaires
   ```

   This is a standalone additive migration; it is **not registered in the old Drizzle journal**. `npm run db:migrate` alone will not run it. The slim production container does not include this TypeScript migration command. Run it from a controlled checkout/migration environment before the application image is enabled. Do not use `db:push` as a substitute for the RLS/trigger migration. Verify tables, notification enum, and RLS in staging. The existing GitHub deployment/Watchtower flow does not provide this migration gate automatically.

3. Start with manual links if email is not configured. For email, configure a verified Resend sender, `RESEND_API_KEY`, `QUESTIONNAIRE_EMAIL_FROM`, optional `QUESTIONNAIRE_EMAIL_REPLY_TO`, `QUESTIONNAIRE_MAIL_SECRET` (random, at least 32 characters), and `QUESTIONNAIRE_WEBHOOK_SECRET`. Register the signed provider webhook at `https://YOUR_DOMAIN/api/questionnaires/webhook` for delivered, bounced, complained, and failed events. Set `QUESTIONNAIRE_MAIL_ENABLED=true` only after staging verification. Keep the mail secret stable while jobs remain queued; rotate after draining/cancelling queued jobs or they cannot be decrypted.
4. The worker runs inside the persistent Node/Docker process every five seconds while enabled; it is not a serverless scheduler. Database leases coordinate multiple app instances. Monitor failed outbox rows and server logs, alert on growing queues, and test process restart recovery. Rate currently processes at most one job per five-second tick per process; 200 immediate invitations can take roughly 17 minutes on one worker before retries. Scheduled time is earliest eligibility, not a delivery guarantee.
5. For attachments, configure the existing private S3/MinIO settings and enable the optional scanner:

   ```sh
   docker compose --profile questionnaire-uploads up -d questionnaire-scanner
   ```

   Set `QUESTIONNAIRE_CLAMAV_HOST=questionnaire-scanner` for the app container and port 3310. Do not publish this unauthenticated TCP port. The compose service uses the official `stable_base` image, private networking, a signatures volume, and a 4 GB memory allowance. Pin a reviewed image tag/digest for a controlled production rollout, wait for signatures to initialize, and verify update health. See the [official ClamAV container guidance](https://docs.clamav.net/manual/Installing/Docker.html).

6. Verify proxy limits support the application's 26 MiB multipart request limit, HTTPS cookies work on the actual domain, the bucket is private, and webhook signature headers survive the proxy. Publishing an upload question checks that storage/scanner configuration exists; it does not prove those services are healthy.
7. Run the acceptance suite below against staging, including real provider sandbox/test recipients and scanner acceptance/rejection. Set a data retention period, back up both database and objects, and establish a controlled deletion process. No automated data-erasure/retention tool is provided yet; immutable-version triggers intentionally prevent casual version deletion.

## Limits and differences from the full plan

These are deliberate current boundaries, not features silently promised by a published form:

- Maximum 100 questions, 30 sections, 200 options per question, and 50 matrix rows. Maximum 200 recipients per import/send and 10,000 invitations per questionnaire. Results load up to that bounded study size; large-study server pagination and load certification are not implemented.
- Each attachment is at most 25 MiB, up to 10 configured files per file question, and 100 MiB total uploaded per response. Removed/replaced files still count toward total storage until an operator purges orphan objects. Upload requests are sequential per file and show the renderer's upload state; there is no byte-level percentage UI or resumable large-file upload.
- Conditions are question/section visibility and conditional requiredness, plus carried selections. The author cannot configure arbitrary expressions/scripts, explicit jump-to-section, early-exit outcomes, question-answer piping, or per-option visibility yet.
- Ranking uses minimum/maximum selections for top-N or rank-all requirements; a full rank-distribution report remains pending. Ratings currently use numbered buttons, not switchable stars. Number units are labels, not currency conversion/locale formatting. Date/time lack range/timezone/timestamp configuration. Phone fields do not perform country-specific validation. Image choice uses maximum selections = 1 for single selection or a larger/unlimited maximum for multiple selections. Yes/no labels are fixed.
- Content supports escaped plain text and HTTPS media, not a rich text editor, author-side media upload, or automatic captions/transcripts. Supply accessible media yourself.
- No custom branded email editor, repeated reminder schedules, OTP, anonymous/open links, multilingual switching, calculated/scored outcomes, quotas, approval workflows, or custom themes beyond the current UI.
- No response flags/manual text themes, side-by-side cohort comparison, completion-time/drop-off charts, advanced owner/tag library filters, response-to-task creation, or full audit-event viewer. Existing notification/customer activity integration is implemented, but not those broader workflows.
- PDF export is basic respondent tables using built-in fonts, not the designed aggregate report proposed in the plan. Full non-Latin font coverage and PDF visual QA remain pending; prefer CSV/XLSX for unrestricted Unicode data.
- Retention/erasure automation, orphan-file cleanup, operational queue dashboards, database restore drills, load tests, and full role-isolation tests with real Supabase users remain acceptance work.

## Verification and release blockers

Local automated commands:

```sh
npm run lint -- --quiet
npm run build
npm run test:questionnaires
QUESTIONNAIRE_TEST_ORIGIN=http://127.0.0.1:3100 npm run test:questionnaires
```

The latest local pass completed with **45 tests passed, none skipped**, plus a successful production build, TypeScript check, and lint check. The last command requires the isolated local server and refuses a real connected workspace. Tests cover all 23 renderer/server type paths, custom control markup, all three presentation modes, read-only rendering, randomized matrix column order, defaults, conditions, carry-forward, validation, statistics, spreadsheet safety, permission combinations, repeatable migration/RLS/version invariants, webhook ordering, and the full HTTP lifecycle. HTTP checks include draft conflicts, personal sessions, CSRF, autosave, upload/download ownership, submit retries, immutable publication, export endpoints, reopening/history, revocation, and closure. The GitHub questionnaire-checks workflow runs lint, tests, build, and the isolated HTTP lifecycle; it does not deploy.

Manual browser QA has exercised desktop and 390 px mobile layouts, authoring/preview, individual invitation start, saved-answer return, interactive ranking buttons, choice/matrix/consent answers, review/submit, individual response history, and aggregate results. The redesigned renderer was also checked for full-tile click targets, keyboard selection and ranking, searchable dropdowns, exclusive None choices, Other text, rating/NPS selection, explicit slider/number zero and boolean false, dates/times, and native file selection through review and completion. Preview attachment selection passed in the browser; upload/storage/download security passed through the HTTP lifecycle. A real production-storage browser upload remains a staging acceptance item. No whole-site WCAG certification or complete screen-reader audit is claimed. Real Resend delivery and a running ClamAV service have not been tested in this environment.

**Dependency release blocker:** `npm audit --omit=dev` on 11 September 2026 reports seven production advisories: one critical (`next`), four high (`@xmldom/xmldom`, `nanoid`, nested `postcss`, `sharp`), and two moderate (`baseline-browser-mapping`, `dompurify`). These pre-existing dependency families need a reviewed upgrade and whole-site regression pass before external release; a successful build does not resolve them. Do not run an unreviewed force upgrade as part of deployment.

The old vulnerable spreadsheet dependency was updated from npm's `xlsx` 0.18.5 to the authoritative SheetJS 0.20.3 tarball with a locked integrity hash. This also affects the site's existing spreadsheet consumers. The old npm registry release and corrected distribution are documented in the [official SheetJS installation guide](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). Verify those existing consumers during the whole-site regression pass.
