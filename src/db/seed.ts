// ETL: fixtures.ts → the real schema. Run once against a freshly-migrated
// database (`npm run db:push && npm run db:seed`) to get the same data the
// UI has been running against all along, for real, so every screen can be
// cut over from fixtures.ts to Drizzle queries with nothing changing on
// screen. Re-running against a non-empty database will violate primary
// key constraints by design — this seeds an empty database once.

import "dotenv/config";
import { db } from "./client";
import * as schema from "./schema";
import * as fx from "../lib/fixtures";

// This week's Monday at local midnight — the same anchor
// calendar-view.tsx's own startOfWeek() computes, so seeded events land on
// the actual current week instead of a fixed date that immediately goes stale.
function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const DAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };

function atHour(monday: Date, day: string, hour: number) {
  const date = new Date(monday);
  date.setDate(monday.getDate() + DAY_INDEX[day]);
  date.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  return date;
}

async function main() {
  console.log("Seeding…");

  // ─── Profiles (owners) — capture slug → generated uuid for every other
  // table's owner/assignee/author references, since fixtures.ts ids
  // ("nima", "sara", "jon") are slugs but profiles.id is a real uuid.
  const profileIdBySlug = new Map<string, string>();
  const insertedProfiles = await db
    .insert(schema.profiles)
    .values(
      fx.owners.map((o) => {
        const prefs = fx.notificationPrefs[o.id];
        return {
          name: o.name,
          initials: o.initials,
          color: o.color,
          email: o.email,
          role: o.role,
          active: o.active,
          staleDays: prefs?.staleDays,
          followupLeadHours: prefs?.followupLeadHours,
          interviewLeadMinutes: prefs?.interviewLeadMinutes,
          emailDigest: prefs?.emailDigest,
        };
      }),
    )
    .returning({ id: schema.profiles.id });
  fx.owners.forEach((o, i) => profileIdBySlug.set(o.id, insertedProfiles[i].id));

  const uid = (slug: string) => {
    const id = profileIdBySlug.get(slug);
    if (!id) throw new Error(`Unknown owner slug: ${slug}`);
    return id;
  };

  // ─── Singleton app config
  await db.insert(schema.appConfig).values({ id: 1, ...fx.appConfig });

  // ─── Segments, stages
  await db.insert(schema.segments).values(fx.segments.map((s, i) => ({ ...s, sortOrder: i })));
  await db.insert(schema.stages).values(fx.stages.map((s, i) => ({ ...s, sortOrder: i })));

  // ─── Customers, contacts
  await db.insert(schema.customers).values(
    fx.customers.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      segmentId: c.segmentId,
      stage: c.stage,
      followup: c.followup,
      problem: c.problem,
      compatibility: c.compatibility,
      priority: c.priority,
      website: c.website,
      currentSolution: c.currentSolution,
      interviewDate: c.interviewDate,
      tags: c.tags ?? [],
      ownerId: uid(c.ownerId),
      archived: c.archived ?? false,
      nextStep: c.nextStep,
      // idleDays is derived in the fixtures; approximate a matching
      // last-touched date so the real idleDays computation lines up on day one.
      lastTouchedAt: new Date(Date.now() - c.idleDays * 86_400_000),
    })),
  );

  await db.insert(schema.contacts).values(
    fx.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      customerId: c.customerId,
      email: c.email,
      phone: c.phone,
      linkedin: c.linkedin,
      preferredChannel: c.preferredChannel,
    })),
  );

  // ─── Topics + members
  await db.insert(schema.topics).values(
    fx.topics.map((t) => ({ id: t.id, name: t.name, color: t.color, visibility: t.visibility })),
  );
  const topicMemberRows = fx.topics.flatMap((t) =>
    t.memberIds.map((m) => ({ topicId: t.id, profileId: uid(m) })),
  );
  if (topicMemberRows.length) await db.insert(schema.topicMembers).values(topicMemberRows);

  // ─── Conversations (+ conversation_details merged in) and their join tables
  await db.insert(schema.conversations).values(
    fx.conversations.map((c) => {
      const d = fx.detailsFor(c.id);
      return {
        id: c.id,
        title: c.title,
        topicId: c.topicId,
        authorId: uid(c.authorId),
        status: c.status,
        shared: c.shared,
        summary: c.summary,
        noteBody: c.noteBody,
        wave: c.wave,
        source: d?.source,
        language: d?.language,
        durationMs: d?.durationMs ?? 0,
        editedBy: d?.editedBy ? uid(d.editedBy) : null,
        aiTags: d?.aiTags ?? [],
      };
    }),
  );

  const participantRows = fx.conversations.flatMap((c) =>
    c.participantIds.map((customerId) => ({ conversationId: c.id, customerId })),
  );
  if (participantRows.length) await db.insert(schema.conversationParticipants).values(participantRows);

  const conversationContactRows = fx.conversations.flatMap((c) =>
    c.contactIds.map((contactId) => ({ conversationId: c.id, contactId })),
  );
  if (conversationContactRows.length) await db.insert(schema.conversationContacts).values(conversationContactRows);

  // ─── Per-conversation depth: speakers, chapters, utterances, decisions/
  // follow-ups, comments, Q&A, action items — one conversation at a time so
  // action items and Q&A citations can grab their parent row's generated id.
  for (const c of fx.conversations) {
    const d = fx.detailsFor(c.id);
    if (!d) continue;

    if (d.speakers?.length) {
      await db.insert(schema.speakers).values(
        d.speakers.map((s) => ({ conversationId: c.id, label: s.label, name: s.name, color: s.color })),
      );
    }

    if (d.chapters?.length) {
      await db.insert(schema.chapters).values(
        d.chapters.map((ch) => ({ conversationId: c.id, title: ch.title, summary: ch.summary, startMs: ch.startMs })),
      );
    }

    if (d.utterances?.length) {
      await db.insert(schema.utterances).values(
        d.utterances.map((u) => ({
          conversationId: c.id,
          speakerLabel: u.speaker,
          text: u.text,
          startMs: u.startMs,
          lowConfidence: u.lowConfidence ?? false,
        })),
      );
    }

    const traceRows = [
      ...(d.decisions ?? []).map((t) => ({ conversationId: c.id, kind: "decision" as const, text: t.text, sourceMs: t.sourceMs })),
      ...(d.followUps ?? []).map((t) => ({ conversationId: c.id, kind: "followup" as const, text: t.text, sourceMs: t.sourceMs })),
    ];
    if (traceRows.length) await db.insert(schema.traceItems).values(traceRows);

    if (d.comments?.length) {
      await db.insert(schema.comments).values(
        d.comments.map((cm) => ({
          entityType: "conversation" as const,
          entityId: c.id,
          authorId: uid(cm.authorId),
          body: cm.body,
          atMs: cm.atMs,
        })),
      );
    }

    if (d.qa?.length) {
      for (const m of d.qa) {
        const [inserted] = await db
          .insert(schema.qaMessages)
          .values({ conversationId: c.id, role: m.role, content: m.content })
          .returning({ id: schema.qaMessages.id });
        if (m.citations?.length) {
          await db.insert(schema.qaCitations).values(
            m.citations.map((cit) => ({
              qaMessageId: inserted.id,
              quote: cit.quote,
              startMs: cit.startMs,
              speakerLabel: cit.speaker,
            })),
          );
        }
      }
    }

    if (d.actionItems?.length) {
      for (const a of d.actionItems) {
        const [inserted] = await db
          .insert(schema.tasks)
          .values({
            task: a.task,
            status: a.status,
            dueLabel: a.dueLabel,
            sourceType: "conversation" as const,
            conversationId: c.id,
            sourceMs: a.sourceMs,
          })
          .returning({ id: schema.tasks.id });
        if (a.assigneeIds.length) {
          await db.insert(schema.taskAssignees).values(a.assigneeIds.map((aid) => ({ taskId: inserted.id, profileId: uid(aid) })));
        }
      }
    }
  }

  // ─── Manual (customer-page) tasks
  for (const [customerId, tasksForCustomer] of Object.entries(fx.customerTasks)) {
    for (const t of tasksForCustomer) {
      const [inserted] = await db
        .insert(schema.tasks)
        .values({ task: t.task, status: t.status, dueLabel: t.dueLabel, sourceType: "customer" as const, customerId })
        .returning({ id: schema.tasks.id });
      if (t.assigneeIds.length) {
        await db.insert(schema.taskAssignees).values(t.assigneeIds.map((aid) => ({ taskId: inserted.id, profileId: uid(aid) })));
      }
    }
  }

  // ─── Validation notes, activity
  for (const [customerId, notes] of Object.entries(fx.validationNotes)) {
    await db.insert(schema.validationNotes).values(
      notes.map((n) => ({
        customerId,
        authorId: uid(n.authorId),
        body: n.body,
        quote: n.quote,
        conversationId: n.conversationId,
      })),
    );
  }

  for (const [customerId, events] of Object.entries(fx.customerActivity)) {
    await db.insert(schema.activities).values(
      events.map((e) => ({ entityType: "customer" as const, entityId: customerId, ownerId: uid(e.ownerId), text: e.text })),
    );
  }

  // ─── Calendar feeds + this week's events
  const feedIdBySlug = new Map<string, string>();
  const insertedFeeds = await db
    .insert(schema.calendarFeeds)
    .values(
      fx.calendarFeeds.map((f) => ({
        ownerId: uid(f.ownerId),
        label: f.label,
        color: f.color,
        visibility: f.visibility,
        internal: f.internal ?? false,
        syncStatus: f.syncStatus,
        lastSyncedAt: f.lastSyncedMinutes != null ? new Date(Date.now() - f.lastSyncedMinutes * 60_000) : null,
      })),
    )
    .returning({ id: schema.calendarFeeds.id });
  fx.calendarFeeds.forEach((f, i) => feedIdBySlug.set(f.id, insertedFeeds[i].id));

  const monday = startOfWeek(new Date());
  await db.insert(schema.calendarEvents).values(
    fx.calendarEvents.map((e) => ({
      feedId: feedIdBySlug.get(e.feedId)!,
      ownerId: uid(e.ownerId),
      title: e.title,
      kind: e.kind,
      customerId: e.customerId,
      allDay: e.allDay ?? false,
      startAt: atHour(monday, e.day, e.startHour),
      endAt: atHour(monday, e.day, e.endHour),
    })),
  );

  console.log(`Seeded ${fx.owners.length} profiles, ${fx.customers.length} customers, ${fx.conversations.length} conversations.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
