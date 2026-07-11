"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  Archive,
  CalendarCheck,
  CheckSquare,
  GlobeHemisphereWest,
  NotePencil,
  Tag,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { Drawer } from "@/components/ui/drawer";
import { DetailField } from "@/components/ui/detail-field";
import {
  ownerById,
  primaryContactFor,
  segmentById,
  type Contact,
  type Customer,
  type Owner,
  type Segment,
  type Stage,
} from "@/lib/fixtures";
import { SectionHeader } from "@/components/ui/section-header";
import { getCustomerQuickView, type CustomerQuickView } from "@/lib/data/customers-actions";
import { CompatibilityBadge } from "./compatibility-badge";
import { FollowupPill, PriorityPill, ProblemPill, StagePill } from "./status-pills";

const EMPTY_QUICK_VIEW: CustomerQuickView = { conversations: [], noteCount: 0, openTaskCount: 0 };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
      {children}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <span className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
        {children}
      </span>
    </div>
  );
}

export function CustomerDrawer({
  customer,
  stages,
  segments,
  owners,
  contacts,
  onClose,
}: {
  customer: Customer | null;
  stages: Stage[];
  segments: Segment[];
  owners: Owner[];
  contacts: Contact[];
  onClose: () => void;
}) {
  const customerId = customer?.id;
  const [quickView, setQuickView] = useState<CustomerQuickView>(EMPTY_QUICK_VIEW);
  const [loaded, setLoaded] = useState(false);

  // Fetched on open rather than joined into every customer list's initial
  // load — the drawer is a lightweight glance, not the full Customer Room.
  // Synchronizing to a server fetch keyed on customerId is exactly what
  // effects are for; the setState calls are the point, not a smell.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false);
    if (!customerId) {
      setQuickView(EMPTY_QUICK_VIEW);
      return;
    }
    let cancelled = false;
    void getCustomerQuickView(customerId).then((data) => {
      if (!cancelled) {
        setQuickView(data);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (!customer) return null;

  const segment = segmentById(customer.segmentId, segments);
  const owner = ownerById(customer.ownerId, owners);
  const contact = primaryContactFor(customer.id, contacts);
  const { conversations, noteCount, openTaskCount } = quickView;

  return (
    <Drawer open onClose={onClose} label={`${customer.name} quick view`}>
      <div className="flex min-h-full flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {customer.name}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-[2px]"
                style={{ background: segment.color }}
              />
              {segment.name}
              {contact && <span>· {contact.name}</span>}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close quick view"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-3 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </header>

        <div className="flex flex-wrap gap-1.5">
          <StagePill stage={customer.stage} stages={stages} />
          <PriorityPill priority={customer.priority} />
          <FollowupPill followup={customer.followup} />
          <ProblemPill problem={customer.problem} />
          {customer.archived && (
            <Pill tone="gray">
              <span className="inline-flex items-center gap-1">
                <Archive size={12} />
                Archived
              </span>
            </Pill>
          )}
        </div>

        <dl className="recessed grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-3">
          <Fact label="Compatibility">
            <CompatibilityBadge compatibility={customer.compatibility} />
          </Fact>
          <Fact label="Lead">
            <Avatar owner={owner} size={20} />
            {owner.name}
          </Fact>
          <Fact label="Last touch">
            <span className="font-mono tabular-nums">
              {customer.idleDays === 0 ? "today" : `${customer.idleDays} d ago`}
            </span>
          </Fact>
          {customer.country && <Fact label="Country">{customer.country}</Fact>}
        </dl>

        {contact && (contact.email || contact.phone) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="truncate text-[13.5px] text-ink-2 transition-colors duration-150 hover:text-accent"
              >
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <span className="font-mono text-[13.5px] text-ink-2 tabular-nums">
                {contact.phone}
              </span>
            )}
          </div>
        )}

        {customer.website && (
          <a
            href={customer.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2 transition-colors duration-150 hover:text-accent"
          >
            <GlobeHemisphereWest size={14} />
            {customer.website.replace(/^https?:\/\//, "")}
          </a>
        )}

        {(customer.currentSolution || customer.interviewDate) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {customer.currentSolution && (
              <DetailField icon={<Wrench size={13} />}>{customer.currentSolution}</DetailField>
            )}
            {customer.interviewDate && (
              <DetailField icon={<CalendarCheck size={13} />}>
                <span className="font-mono tabular-nums">
                  Interviewed {customer.interviewDate}
                </span>
              </DetailField>
            )}
          </div>
        )}

        {customer.tags && customer.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag size={13} className="text-ink-3" />
            {customer.tags.map((t) => (
              <Pill key={t} tone="gray">
                {t}
              </Pill>
            ))}
          </div>
        )}

        {customer.nextStep && (
          <div>
            <SectionHeader className="mb-1.5">Next step</SectionHeader>
            <p className="text-[14.5px] leading-relaxed text-ink-2">
              {customer.nextStep}
            </p>
          </div>
        )}

        {(noteCount > 0 || openTaskCount > 0) && (
          <div className="flex items-center gap-4">
            {noteCount > 0 && (
              <DetailField icon={<NotePencil size={13} />}>
                {noteCount} validation note{noteCount === 1 ? "" : "s"}
              </DetailField>
            )}
            {openTaskCount > 0 && (
              <DetailField icon={<CheckSquare size={13} />}>
                {openTaskCount} open task{openTaskCount === 1 ? "" : "s"}
              </DetailField>
            )}
          </div>
        )}

        <div>
          <SectionHeader
            count={conversations.length > 0 ? conversations.length : undefined}
            className="mb-1.5"
          >
            Conversations
          </SectionHeader>
          {!loaded ? (
            <div className="mt-1.5 flex flex-col gap-2" aria-hidden>
              <div className="h-[42px] animate-pulse rounded-card bg-surface-2" />
              <div className="h-[42px] animate-pulse rounded-card bg-surface-2" />
            </div>
          ) : conversations.length > 0 ? (
            <div className="mt-1.5 flex flex-col gap-2">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href={`/library/${c.id}`}
                  className="surfaced rise-on-hover flex items-center gap-3 px-3 py-2.5"
                >
                  <span className="flex h-5 shrink-0 items-end gap-[2px]" aria-hidden>
                    {c.wave.slice(0, 9).map((v, i) => (
                      <span
                        key={i}
                        className="w-[2.5px] rounded-full bg-accent/70"
                        style={{ height: `${Math.round(v * 0.8)}px` }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                    {c.title}
                  </span>
                  <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink-2 tabular-nums">
                    {c.when} · {c.duration}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[14px] text-ink-3">
              No conversations yet. Record the first one from the customer page.
            </p>
          )}
        </div>

        <div className="mt-auto pt-2">
          <Link
            href={`/customers/${customer.id}`}
            className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong"
          >
            <ArrowSquareOut size={16} />
            Open customer page
          </Link>
        </div>
      </div>
    </Drawer>
  );
}
