"use client";

import { useState } from "react";
import { CheckCircle, CircleNotch, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Switch } from "@/components/ui/switch";
import type { Owner } from "@/lib/fixtures";
import type { AdminPageData } from "@/lib/data/settings";
import { toggleUserActive, toggleUserRole, updateAppConfig } from "@/lib/data/settings-actions";

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: string }) {
  return (
    <div className="surfaced flex items-center gap-3 px-4 py-3.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone ?? "bg-accent/10 text-accent"}`}>
        {icon}
      </span>
      <div>
        <p className="font-mono text-[18px] font-bold leading-none tabular-nums text-ink">{value}</p>
        <p className="mt-1 text-[12px] font-semibold text-ink-2">{label}</p>
      </div>
    </div>
  );
}

export function AdminView({ roster: initialRoster, config: initialConfig, queueHealth }: AdminPageData) {
  const [roster, setRoster] = useState<Owner[]>(initialRoster);
  const [config, setConfig] = useState(initialConfig);

  const toggleActive = (id: string) => {
    const next = !roster.find((o) => o.id === id)?.active;
    setRoster((rs) => rs.map((o) => (o.id === id ? { ...o, active: next } : o)));
    void toggleUserActive(id, next);
  };

  const toggleRole = (id: string) => {
    const nextRole = roster.find((o) => o.id === id)?.role === "admin" ? "member" : "admin";
    setRoster((rs) => rs.map((o) => (o.id === id ? { ...o, role: nextRole } : o)));
    void toggleUserRole(id, nextRole);
  };

  return (
    <>
      <PageHeader
        title="Admin"
        icon={ShieldCheck}
        meta="User provisioning, SSO configuration, and pipeline health."
        actions={<HeaderStat label="Active users" value={roster.filter((o) => o.active).length} />}
      />

      <div className="mx-auto flex max-w-[960px] flex-col gap-7 px-7 py-6">
        <section className="flex flex-col gap-2.5">
          <SectionHeader>Queue health</SectionHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<CircleNotch size={16} />} label="Processing" value={queueHealth.processing} tone="bg-[rgba(217,178,60,0.16)] text-[#8a6a1a]" />
            <Stat icon={<WarningCircle size={16} />} label="Failed" value={queueHealth.failed} tone={queueHealth.failed > 0 ? "bg-[rgba(192,70,58,0.16)] text-[#c0463a]" : undefined} />
            <Stat icon={<CheckCircle size={16} />} label="Processed, 24h" value={queueHealth.last24h} />
            <Stat icon={<CircleNotch size={16} />} label="Avg. process time" value={`${queueHealth.avgProcessMinutes}m`} />
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader count={roster.length}>Users</SectionHeader>
          <div className="surfaced flex flex-col px-5">
            {roster.map((o) => (
              <div key={o.id} className="flex items-center gap-3 border-t border-line-2 py-3 first:border-t-0">
                <Avatar owner={o} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{o.name}</p>
                  <p className="truncate text-[12.5px] text-ink-2">{o.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleRole(o.id)}
                  className="shrink-0 cursor-pointer rounded-full bg-[rgba(23,32,43,0.07)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-2 transition-colors duration-150 hover:bg-[rgba(23,32,43,0.13)] hover:text-ink"
                  title="Click to change role"
                >
                  {o.role}
                </button>
                <Switch checked={o.active ?? false} onChange={() => toggleActive(o.id)} label={`Toggle ${o.name} active`} />
              </div>
            ))}
            <p className="border-t border-line-2 py-3 text-[12.5px] text-ink-2">
              No public sign-up — accounts are provisioned here or auto-created on first SSO
              login from an allowed domain.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <SectionHeader>Single sign-on</SectionHeader>
          <div className="surfaced flex flex-col px-5">
            <div className="flex items-center justify-between gap-4 py-3.5">
              <span className="text-[14px] font-semibold text-ink">Microsoft Entra SSO</span>
              <Switch
                checked={config.ssoEnabled}
                onChange={() => {
                  const next = !config.ssoEnabled;
                  setConfig((c) => ({ ...c, ssoEnabled: next }));
                  void updateAppConfig({ ssoEnabled: next });
                }}
                label="Toggle Microsoft SSO"
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line-2 py-3.5">
              <span className="text-[14px] font-semibold text-ink">Tenant</span>
              <span className="font-mono text-[13px] text-ink-2">{config.ssoTenant}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line-2 py-3.5">
              <span className="text-[14px] font-semibold text-ink">Allowed domains</span>
              <div className="flex gap-1.5">
                {config.allowedDomains.map((d) => (
                  <span key={d} className="rounded-full bg-[rgba(23,32,43,0.07)] px-2.5 py-0.5 font-mono text-[12px] font-semibold text-ink-2">
                    {d}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line-2 py-3.5">
              <span className="text-[14px] font-semibold text-ink">Auto-provision on first login</span>
              <Switch
                checked={config.autoProvision}
                onChange={() => {
                  const next = !config.autoProvision;
                  setConfig((c) => ({ ...c, autoProvision: next }));
                  void updateAppConfig({ autoProvision: next });
                }}
                label="Toggle auto-provisioning"
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line-2 py-3.5">
              <span className="text-[14px] font-semibold text-ink">Public intake form</span>
              <Switch
                checked={config.publicIntake}
                onChange={() => {
                  const next = !config.publicIntake;
                  setConfig((c) => ({ ...c, publicIntake: next }));
                  void updateAppConfig({ publicIntake: next });
                }}
                label="Toggle public intake form"
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
