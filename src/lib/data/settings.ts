// Real Drizzle queries for Settings + Admin. Both notification prefs and
// SSO config already live on real tables (profiles.stale_days etc., the
// singleton app_config row) — no adapter needed, these are 1:1.

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { appConfig, conversations, profiles } from "@/db/schema";
import { toOwnerRow } from "@/lib/data/rows";
import type { Owner } from "@/lib/fixtures";

export type NotificationPrefs = {
  staleDays: number;
  followupLeadHours: number;
  interviewLeadMinutes: number;
  emailDigest: boolean;
};

export type SettingsPageData = {
  me: Owner | null;
  prefs: NotificationPrefs;
  team: Owner[];
};

export async function getSettingsPageData(profileId: string): Promise<SettingsPageData> {
  const ownerRows = await db.select().from(profiles);
  const meRow = ownerRows.find((o) => o.id === profileId);
  return {
    me: meRow ? toOwnerRow(meRow) : null,
    prefs: {
      staleDays: meRow?.staleDays ?? 7,
      followupLeadHours: meRow?.followupLeadHours ?? 24,
      interviewLeadMinutes: meRow?.interviewLeadMinutes ?? 30,
      emailDigest: meRow?.emailDigest ?? true,
    },
    team: ownerRows.map(toOwnerRow),
  };
}

export type QueueHealth = {
  processing: number;
  failed: number;
  last24h: number;
  avgProcessMinutes: number;
};

export type AppConfigData = {
  ssoEnabled: boolean;
  ssoTenant: string | null;
  allowedDomains: string[];
  autoProvision: boolean;
  publicIntake: boolean;
};

export type AdminPageData = {
  roster: Owner[];
  config: AppConfigData;
  queueHealth: QueueHealth;
};

export async function getAdminPageData(): Promise<AdminPageData> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [ownerRows, configRows, processingCount, last24hCount] = await Promise.all([
    db.select().from(profiles),
    db.select().from(appConfig),
    db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(eq(conversations.status, "processing")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(and(gte(conversations.createdAt, dayAgo), sql`${conversations.status} in ('ready', 'reviewed')`)),
  ]);

  const config = configRows[0];

  return {
    roster: ownerRows.map(toOwnerRow),
    config: {
      ssoEnabled: config?.ssoEnabled ?? true,
      ssoTenant: config?.ssoTenant ?? null,
      allowedDomains: config?.allowedDomains ?? [],
      autoProvision: config?.autoProvision ?? true,
      publicIntake: config?.publicIntake ?? true,
    },
    queueHealth: {
      processing: processingCount[0]?.count ?? 0,
      // No "failed" conversation state exists in the schema yet (only
      // processing/ready/reviewed — no transcription pipeline to fail
      // against), and no per-conversation processing-duration tracking
      // exists either — both honestly 0 rather than fabricated.
      failed: 0,
      last24h: last24hCount[0]?.count ?? 0,
      avgProcessMinutes: 0,
    },
  };
}
