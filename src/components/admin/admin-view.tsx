"use client";

import { useState } from "react";
import { CheckCircle, CircleNotch, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader, HeaderStat } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Switch } from "@/components/ui/switch";
import type { Owner } from "@/lib/fixtures";
import type { AdminPageData } from "@/lib/data/settings";
import {
  deleteWorkspaceUser,
  toggleUserActive,
  toggleUserRole,
  updateAppConfig,
} from "@/lib/data/settings-actions";

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

export function AdminView({
  roster: initialRoster,
  config: initialConfig,
  queueHealth,
  currentUserId,
}: AdminPageData & { currentUserId: string }) {
  const [roster, setRoster] = useState<Owner[]>(initialRoster);
  const [config, setConfig] = useState(initialConfig);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleActive = async (id: string) => {
    const previous = roster;
    const next = !roster.find((o) => o.id === id)?.active;
    setRoster((rs) => rs.map((o) => (o.id === id ? { ...o, active: next } : o)));
    setPendingUserId(id);
    setError(null);
    try {
      await toggleUserActive(id, next);
    } catch (cause) {
      setRoster(previous);
      setError(cause instanceof Error ? cause.message : "Couldn’t update this user.");
    } finally {
      setPendingUserId(null);
    }
  };

  const toggleRole = async (id: string) => {
    const previous = roster;
    const nextRole = roster.find((o) => o.id === id)?.role === "admin" ? "member" : "admin";
    setRoster((rs) => rs.map((o) => (o.id === id ? { ...o, role: nextRole } : o)));
    setPendingUserId(id);
    setError(null);
    try {
      await toggleUserRole(id, nextRole);
    } catch (cause) {
      setRoster(previous);
      setError(cause instanceof Error ? cause.message : "Couldn’t update this user.");
    } finally {
      setPendingUserId(null);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target || pendingUserId) return;
    setPendingUserId(target.id);
    setError(null);
    try {
      await deleteWorkspaceUser(target.id);
      setRoster((rows) => rows.filter((row) => row.id !== target.id));
      setDeleteTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t delete this user.");
    } finally {
      setPendingUserId(null);
    }
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
            {error && (
              <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] font-medium leading-snug text-danger">
                {error}
              </p>
            )}
            {roster.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 border-t border-line-2 py-3 first:border-t-0 sm:flex-nowrap">
                <Avatar owner={o} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">
                    {o.name}
                    {o.id === currentUserId && <span className="ml-1.5 text-[12px] font-medium text-ink-3">(you)</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-2">{o.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[rgba(23,32,43,0.07)] px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-2">
                  {o.role}
                </span>
                <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
                  <button
                    type="button"
                    disabled={pendingUserId === o.id}
                    onClick={() => void toggleRole(o.id)}
                    className="h-8 shrink-0 cursor-pointer rounded-md px-2.5 text-[12px] font-bold text-accent transition-colors duration-150 hover:bg-accent/10 hover:text-accent-strong disabled:cursor-wait disabled:opacity-50"
                  >
                    {o.role === "admin" ? "Demote" : "Promote"}
                  </button>
                  <Switch
                    checked={o.active ?? false}
                    onChange={() => void toggleActive(o.id)}
                    label={`Toggle ${o.name} active`}
                    disabled={pendingUserId === o.id}
                  />
                  <button
                    type="button"
                    disabled={o.id === currentUserId || pendingUserId === o.id}
                    onClick={() => setDeleteTarget(o)}
                    title={o.id === currentUserId ? "You can’t delete your own signed-in user" : `Delete ${o.name}`}
                    className="h-8 shrink-0 cursor-pointer rounded-md px-2.5 text-[12px] font-bold text-danger transition-colors duration-150 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <p className="border-t border-line-2 py-3 text-[12.5px] text-ink-2">
              Promotion and deletion are admin-only. Deleting a user removes their sign-in identity and
              personal calendar data; authored workspace history remains, marked unassigned.
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
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete workspace user?"
        body={deleteTarget
          ? `Delete ${deleteTarget.name}’s sign-in identity and personal calendar data. Their workspace history will remain, but no longer be assigned to them.`
          : ""}
        confirmLabel={pendingUserId === deleteTarget?.id ? "Deleting…" : "Delete user"}
        destructive
        onCancel={() => {
          if (!pendingUserId) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
