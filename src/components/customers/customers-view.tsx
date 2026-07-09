"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Buildings,
  CaretDown,
  Check,
  MagnifyingGlass,
  Rows,
  UserPlus,
} from "@phosphor-icons/react";
import { BoardView } from "./board-view";
import { CustomerDrawer } from "./customer-drawer";
import { StageDock } from "./stage-dock";
import { Avatar } from "@/components/ui/avatar";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { useOutsideClick } from "@/lib/use-outside-click";
import {
  BOARD_COLUMNS,
  loadVisibleColumns,
  saveVisibleColumns,
  type BoardColumnId,
} from "@/lib/board-columns";
import {
  customers,
  owners,
  primaryContactFor,
  segments as segmentsSeed,
  stages as stagesSeed,
  SEGMENT_COLOR_ROTATION,
  type Customer,
  type Segment,
  type Stage,
} from "@/lib/fixtures";

function OwnerFilterMenu({
  ownerId,
  onChange,
}: {
  ownerId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const current = owners.find((o) => o.id === ownerId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
      >
        {current ? <Avatar owner={current} size={16} /> : null}
        {current ? current.name : "Everyone"}
        <CaretDown size={12} />
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute right-0 top-10 z-30 w-48 p-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
          >
            Everyone
            {ownerId === null && <Check size={14} weight="bold" className="ml-auto text-melt" />}
          </button>
          {owners.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
            >
              <Avatar owner={o} size={18} />
              {o.name}
              {ownerId === o.id && <Check size={14} weight="bold" className="ml-auto text-melt" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnsMenu({
  visible,
  onToggle,
}: {
  visible: Set<BoardColumnId>;
  onToggle: (id: BoardColumnId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const hiddenCount = BOARD_COLUMNS.length - visible.size;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-[13px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-surface-2"
      >
        <Rows size={15} />
        Columns
        {hiddenCount > 0 && (
          <span className="rounded-full bg-[rgba(11,61,77,0.08)] px-1.5 font-mono text-[11px] text-ink-3 tabular-nums">
            {hiddenCount} hidden
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="surfaced-lg absolute right-0 top-10 z-30 w-48 p-1.5">
          {BOARD_COLUMNS.map((col) => {
            const checked = visible.has(col.id);
            return (
              <button
                key={col.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={() => onToggle(col.id)}
                className="flex w-full cursor-pointer items-center rounded-md px-2.5 py-2 text-left text-[14px] text-ink transition-colors duration-150 hover:bg-surface-2"
              >
                {col.label}
                {checked && <Check size={14} weight="bold" className="ml-auto text-melt" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CustomersView() {
  const [rows, setRows] = useState<Customer[]>(customers);
  const [stages] = useState<Stage[]>(stagesSeed);
  const [segments, setSegments] = useState<Segment[]>(segmentsSeed);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<BoardColumnId>>(
    () => new Set(loadVisibleColumns()),
  );

  useEffect(() => {
    saveVisibleColumns([...visibleColumns]);
  }, [visibleColumns]);

  const router = useRouter();
  const searchParams = useSearchParams();
  const openCustomer = rows.find((c) => c.id === searchParams.get("c")) ?? null;

  const open = useCallback(
    (id: string) => router.push(`/customers?c=${id}`, { scroll: false }),
    [router],
  );
  const close = useCallback(
    () => router.push("/customers", { scroll: false }),
    [router],
  );

  const moveSegment = useCallback((id: string, segmentId: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, segmentId } : r)));
  }, []);

  const addSegment = useCallback((name: string) => {
    setSegments((ss) => {
      const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ss.length}`;
      const color = SEGMENT_COLOR_ROTATION[ss.length % SEGMENT_COLOR_ROTATION.length];
      return [...ss, { id, name, color }];
    });
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((gs) => {
      const next = new Set(gs);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleColumn = useCallback((id: BoardColumnId) => {
    setVisibleColumns((cols) => {
      const next = new Set(cols);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const q = search.trim().toLowerCase();
  const filteredRows = rows.filter((c) => {
    if (ownerFilter && c.ownerId !== ownerFilter) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (primaryContactFor(c.id)?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const validated = rows.filter((c) => c.stage === "validated").length;
  const overdue = rows.filter((c) => c.followup === "overdue").length;

  return (
    <>
      <PageHeader
        title="Customers"
        icon={Buildings}
        meta="Companies and people grouped by segment. Validation stage lives in Validation Progress."
        actions={
          <>
            <HeaderStat label="Customers" value={rows.length} />
            <HeaderStat label="Validated" value={validated} divider />
            <HeaderStat
              label="Overdue"
              value={overdue}
              divider
              tone={overdue > 0 ? "text-[#b23c2e]" : "text-ink"}
            />
            <Link
              href="/customers/new"
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-melt/60 px-3.5 text-[14px] font-bold text-melt transition-colors duration-150 hover:bg-melt/10"
            >
              <UserPlus size={16} />
              New customer
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="recessed flex h-9 items-center gap-2 px-3">
            <MagnifyingGlass size={15} className="shrink-0 text-ink-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter companies"
              aria-label="Filter companies"
              className="w-40 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <OwnerFilterMenu ownerId={ownerFilter} onChange={setOwnerFilter} />
          <ColumnsMenu visible={visibleColumns} onToggle={toggleColumn} />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        <BoardView
          rows={filteredRows}
          stages={stages}
          segments={segments}
          stageFilter={stageFilter}
          visibleColumns={visibleColumns}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          onOpen={open}
          onMoveSegment={moveSegment}
          onAddSegment={addSegment}
        />
        <StageDock
          rows={filteredRows}
          stages={stages}
          activeStage={stageFilter}
          onSelect={setStageFilter}
        />
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
