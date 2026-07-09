"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Gear, ShieldCheck } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Switch } from "@/components/ui/switch";
import { notificationPrefs, owners, type NotificationPrefs } from "@/lib/fixtures";

const CURRENT_USER = "nima";

// Data-palette swatches, same set DESIGN.md reserves for owners/tags/calendar.
const AVATAR_COLORS = ["#0295ac", "#14b8ce", "#27b577", "#6e5be8", "#f26d5f", "#2f6fd0"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line-2 py-3.5 first:border-t-0">
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      {children}
    </div>
  );
}

export function SettingsView() {
  const me = owners.find((o) => o.id === CURRENT_USER)!;
  const [color, setColor] = useState(me.color);
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    notificationPrefs[CURRENT_USER] ?? { staleDays: 7, followupLeadHours: 24, interviewLeadMinutes: 30, emailDigest: true },
  );

  const setColorApplied = (hex: string) => {
    setColor(hex);
    Object.assign(me, { color: hex });
  };

  const num = (key: keyof NotificationPrefs) => (
    <input
      type="number"
      min={0}
      value={prefs[key] as number}
      onChange={(e) => setPrefs((p) => ({ ...p, [key]: Number(e.target.value) }))}
      className="recessed h-8 w-16 px-2 text-right font-mono text-[13.5px] text-ink outline-none"
    />
  );

  return (
    <>
      <PageHeader title="Settings" icon={Gear} meta="Your profile, notification preferences, and the team roster." />

      <div className="mx-auto flex max-w-[760px] flex-col gap-7 px-7 py-6">
        <section className="flex flex-col gap-2.5">
          <SectionHeader>Profile</SectionHeader>
          <div className="surfaced flex flex-col gap-4 px-5 py-4">
            <div className="flex items-center gap-3.5">
              <Avatar owner={{ ...me, color }} size={44} />
              <div>
                <p className="text-[15.5px] font-semibold text-ink">{me.name}</p>
                <p className="text-[13px] text-ink-2">{me.email}</p>
              </div>
              <span className="ml-auto rounded-full bg-[rgba(11,61,77,0.07)] px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">
                {me.role}
              </span>
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Avatar color</p>
              <div className="flex gap-2">
                {AVATAR_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Use ${hex} as avatar color`}
                    onClick={() => setColorApplied(hex)}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-shadow duration-150"
                    style={{
                      background: hex,
                      boxShadow: color === hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : "none",
                    }}
                  >
                    {color === hex && <Check size={13} weight="bold" className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader>Notifications</SectionHeader>
          <div className="surfaced flex flex-col px-5">
            <Field label="Flag an account as going stale after (days)">{num("staleDays")}</Field>
            <Field label="Remind me before a follow-up is due (hours)">{num("followupLeadHours")}</Field>
            <Field label="Remind me before an interview (minutes)">{num("interviewLeadMinutes")}</Field>
            <Field label="Daily email digest">
              <Switch
                checked={prefs.emailDigest}
                onChange={() => setPrefs((p) => ({ ...p, emailDigest: !p.emailDigest }))}
                label="Toggle daily email digest"
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader
            count={owners.length}
            action={
              <Link href="/admin" className="flex items-center gap-1 text-[12.5px] font-bold text-melt hover:text-melt-strong">
                <ShieldCheck size={13} />
                Manage in Admin
              </Link>
            }
          >
            Team
          </SectionHeader>
          <div className="surfaced flex flex-col px-5">
            {owners.map((o) => (
              <div key={o.id} className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0">
                <Avatar owner={o} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{o.name}</p>
                  <p className="truncate text-[12.5px] text-ink-2">{o.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[rgba(11,61,77,0.07)] px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-2">
                  {o.role}
                </span>
                <span
                  className={`shrink-0 text-[12px] font-semibold ${o.active ? "text-[#157a4e]" : "text-ink-3"}`}
                >
                  {o.active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
