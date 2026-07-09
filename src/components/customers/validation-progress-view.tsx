"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowCounterClockwise, Archive, Kanban } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { CustomerDrawer } from "./customer-drawer";
import { KanbanView } from "./kanban-view";
import { CompatibilityBadge } from "./compatibility-badge";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import {
  customers,
  ownerById,
  primaryContactFor,
  segmentById,
  segments as segmentsSeed,
  stages as stagesSeed,
  STAGE_TONE_ROTATION,
  type Customer,
  type Segment,
  type Stage,
  type StageKey,
} from "@/lib/fixtures";

export function ValidationProgressView() {
  const [rows, setRows] = useState<Customer[]>(() => [...customers]);
  const [stages, setStages] = useState<Stage[]>(stagesSeed);
  const [segments] = useState<Segment[]>(segmentsSeed);

  const router = useRouter();
  const searchParams = useSearchParams();
  const openCustomer = rows.find((c) => c.id === searchParams.get("c")) ?? null;

  const open = useCallback(
    (id: string) => router.push(`/validation-progress?c=${id}`, { scroll: false }),
    [router],
  );
  const close = useCallback(
    () => router.push("/validation-progress", { scroll: false }),
    [router],
  );

  const moveStage = useCallback((id: string, stage: StageKey) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        Object.assign(r, { stage });
        return { ...r, stage };
      }),
    );
  }, []);

  const setArchived = useCallback((id: string, archived: boolean) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        Object.assign(r, { archived });
        return { ...r, archived };
      }),
    );
  }, []);

  const addStage = useCallback((label: string) => {
    setStages((ss) => {
      const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ss.length}`;
      const tone = STAGE_TONE_ROTATION[ss.length % STAGE_TONE_ROTATION.length];
      return [...ss, { key, label, tone }];
    });
  }, []);

  const renameStage = useCallback((key: StageKey, label: string) => {
    setStages((ss) => ss.map((s) => (s.key === key ? { ...s, label } : s)));
  }, []);

  const activeRows = rows.filter((c) => !c.archived);
  const archivedRows = rows.filter((c) => c.archived);
  const validated = activeRows.filter((c) => c.stage === "validated").length;
  const activeStages = stages.filter((s) => activeRows.some((c) => c.stage === s.key)).length;
  const overdue = activeRows.filter((c) => c.followup === "overdue").length;

  return (
    <>
      <PageHeader
        title="Validation Progress"
        icon={Kanban}
        meta="Move customers through the validation stages. Segment grouping stays on Customers."
        actions={
          <>
            <HeaderStat label="Stages" value={activeStages} />
            <HeaderStat label="Validated" value={validated} divider />
            <HeaderStat label="Archived" value={archivedRows.length} divider />
            <HeaderStat
              label="Overdue"
              value={overdue}
              divider
              tone={overdue > 0 ? "text-[#b23c2e]" : "text-ink"}
            />
          </>
        }
      />

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        <KanbanView
          rows={activeRows}
          stages={stages}
          segments={segments}
          onOpen={open}
          onMoveStage={moveStage}
          onAddStage={addStage}
          onRenameStage={renameStage}
          onArchive={(id) => setArchived(id, true)}
        />
        <section className="mt-6 surfaced px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Archive size={16} className="text-ink-3" />
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.11em] text-ink-2">
              Archive
            </h2>
            <span className="rounded-full bg-[rgba(11,61,77,0.07)] px-2 py-0.5 font-mono text-[11.5px] font-bold text-ink-2 tabular-nums">
              {archivedRows.length}
            </span>
          </div>
          {archivedRows.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {archivedRows.map((customer) => {
                const segment = segmentById(customer.segmentId, segments);
                return (
                  <article key={customer.id} className="recessed flex items-center gap-3 px-3 py-3">
                    <span
                      aria-hidden
                      className="h-8 w-[3px] shrink-0 rounded-full"
                      style={{ background: segment.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => open(customer.id)}
                        className="block max-w-full truncate text-left text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:text-melt"
                      >
                        {customer.name}
                      </button>
                      <p className="truncate text-[12.5px] text-ink-3">
                        {primaryContactFor(customer.id)?.name ?? segment.name}
                      </p>
                    </div>
                    <CompatibilityBadge compatibility={customer.compatibility} />
                    <Avatar owner={ownerById(customer.ownerId)} size={24} />
                    <button
                      type="button"
                      onClick={() => setArchived(customer.id, false)}
                      className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[12.5px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
                    >
                      <ArrowCounterClockwise size={14} />
                      Restore
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-[13.5px] text-ink-3">
              Archived customers land here and stay out of the active Kanban.
            </p>
          )}
        </section>
        <CustomerDrawer
          customer={openCustomer}
          stages={stages}
          segments={segments}
          onClose={close}
        />
      </div>
    </>
  );
}
