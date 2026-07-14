"use client";

import { useCallback, useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Kanban,
  MagnifyingGlass,
  Rows,
  X,
} from "@phosphor-icons/react";
import { CustomerDrawer } from "./customer-drawer";
import { KanbanView } from "./kanban-view";
import { ValidationListView } from "./validation-list-view";
import { Avatar } from "@/components/ui/avatar";
import { HeaderStat, PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { useOutsideClick } from "@/lib/use-outside-click";
import {
  ownerById,
  type Contact,
  type Customer,
  type Owner,
  type Segment,
  type Stage,
  type StageKey,
} from "@/lib/fixtures";
import { addStage as addStageAction, moveCustomerStage, renameStage as renameStageAction, setCustomerArchived } from "@/lib/data/customers-actions";

const STAGE_TONE_ROTATION = ["blue", "cyan", "green", "violet", "coral", "gray"] as const;
type ValidationView = "board" | "list" | "archive";

export function ValidationProgressView({
  customers,
  segments,
  stages: stagesSeed,
  owners,
  contacts,
}: {
  customers: Customer[];
  segments: Segment[];
  stages: Stage[];
  owners: Owner[];
  contacts: Contact[];
}) {
  const [rows, setRows] = useState<Customer[]>(() => [...customers]);
  const [stages, setStages] = useState<Stage[]>(stagesSeed);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [view, setView] = useState<ValidationView>("board");

  // Typeahead: the search field doubles as a finder. While typing, a
  // listbox under the field surfaces the best matches instantly (live
  // value, not the deferred one — the board filter can lag a frame, the
  // suggestions must not), so a customer buried past a column's visible
  // cap is one Enter away instead of eight "show more" taps.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const suggestListId = useId();
  useOutsideClick(searchBoxRef, () => setSuggestOpen(false), suggestOpen);

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
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, stage } : r)));
    void moveCustomerStage(id, stage);
  }, []);

  const setArchived = useCallback((id: string, archived: boolean) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, archived } : r)));
    void setCustomerArchived(id, archived);
  }, []);

  const addStage = useCallback((label: string) => {
    setStages((ss) => {
      const key = `pending-${ss.length}`;
      const tone = STAGE_TONE_ROTATION[ss.length % STAGE_TONE_ROTATION.length];
      return [...ss, { key, label, tone }];
    });
    void addStageAction(label);
  }, []);

  const renameStage = useCallback((key: StageKey, label: string) => {
    setStages((ss) => ss.map((s) => (s.key === key ? { ...s, label } : s)));
    void renameStageAction(key, label);
  }, []);

  const activeRows = useMemo(() => rows.filter((customer) => !customer.archived), [rows]);
  const archivedRows = useMemo(() => rows.filter((customer) => customer.archived), [rows]);
  const query = deferredSearch.trim().toLocaleLowerCase();
  const searchIndex = useMemo(() => {
    const contactsByCustomer = new Map<string, string[]>();
    for (const contact of contacts) {
      if (!contact.customerId) continue;
      const current = contactsByCustomer.get(contact.customerId) ?? [];
      current.push(contact.name, contact.email ?? "");
      contactsByCustomer.set(contact.customerId, current);
    }

    const segmentNameById = new Map(segments.map((segment) => [segment.id, segment.name]));
    const ownerNameById = new Map(owners.map((owner) => [owner.id, owner.name]));
    return new Map(
      rows.map((customer) => [
        customer.id,
        [
          customer.name,
          customer.country,
          customer.nextStep,
          customer.currentSolution,
          ...(customer.tags ?? []),
          ...(contactsByCustomer.get(customer.id) ?? []),
          segmentNameById.get(customer.segmentId),
          ownerNameById.get(customer.ownerId),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(),
      ]),
    );
  }, [contacts, owners, rows, segments]);
  const filteredActiveRows = useMemo(
    () => (query ? activeRows.filter((customer) => searchIndex.get(customer.id)?.includes(query)) : activeRows),
    [activeRows, query, searchIndex],
  );
  const filteredArchivedRows = useMemo(
    () => (query ? archivedRows.filter((customer) => searchIndex.get(customer.id)?.includes(query)) : archivedRows),
    [archivedRows, query, searchIndex],
  );
  const visibleRows = view === "archive" ? filteredArchivedRows : filteredActiveRows;

  // Ranked live matches for the typeahead: name-prefix beats name-contains
  // beats any-field hit (contact, owner, segment, tag, next step), capped
  // at 8 — the same reach as the board filter, just instant and pointable.
  const liveQuery = search.trim().toLocaleLowerCase();
  const suggestions = useMemo(() => {
    if (!liveQuery) return [];
    const pool = view === "archive" ? archivedRows : activeRows;
    return pool
      .map((customer) => {
        const name = customer.name.toLocaleLowerCase();
        const rank = name.startsWith(liveQuery)
          ? 0
          : name.includes(liveQuery)
            ? 1
            : (searchIndex.get(customer.id) ?? "").includes(liveQuery)
              ? 2
              : -1;
        return { customer, rank };
      })
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.customer.name.localeCompare(b.customer.name))
      .slice(0, 8)
      .map((entry) => entry.customer);
  }, [activeRows, archivedRows, liveQuery, searchIndex, view]);
  const stageLabelByKey = useMemo(() => new Map(stages.map((stage) => [stage.key as string, stage.label])), [stages]);
  const segmentNameById = useMemo(() => new Map(segments.map((segment) => [segment.id, segment.name])), [segments]);

  const pickSuggestion = useCallback(
    (id: string) => {
      setSuggestOpen(false);
      setActiveSuggestion(-1);
      open(id);
    },
    [open],
  );

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
              tone={overdue > 0 ? "text-danger" : "text-ink"}
            />
          </>
        }
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <Tabs
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board", icon: Kanban, count: activeRows.length },
              { value: "list", label: "List", icon: Rows, count: activeRows.length },
              { value: "archive", label: "Archive", icon: Archive, count: archivedRows.length },
            ]}
          />
          <div ref={searchBoxRef} className="relative min-w-0 flex-1 sm:ml-auto sm:max-w-[420px]">
            <div className="recessed flex h-10 min-w-0 items-center gap-2 px-3">
              <MagnifyingGlass size={16} className="shrink-0 text-ink-3" />
              <input
                type="search"
                value={search}
                role="combobox"
                aria-expanded={suggestOpen && suggestions.length > 0}
                aria-controls={suggestListId}
                aria-activedescendant={activeSuggestion >= 0 ? `${suggestListId}-${activeSuggestion}` : undefined}
                aria-autocomplete="list"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSuggestOpen(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => {
                  if (search.trim()) setSuggestOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    if (!suggestions.length) return;
                    event.preventDefault();
                    setSuggestOpen(true);
                    setActiveSuggestion((current) => {
                      const delta = event.key === "ArrowDown" ? 1 : -1;
                      return (current + delta + suggestions.length) % suggestions.length;
                    });
                  } else if (event.key === "Enter") {
                    if (suggestOpen && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                      event.preventDefault();
                      pickSuggestion(suggestions[activeSuggestion].id);
                    }
                  } else if (event.key === "Escape") {
                    setSuggestOpen(false);
                    setActiveSuggestion(-1);
                  }
                }}
                placeholder={view === "archive" ? "Search archived customers" : "Search validation customers"}
                aria-label={view === "archive" ? "Search archived customers" : "Search active customers"}
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSuggestOpen(false);
                    setActiveSuggestion(-1);
                  }}
                  aria-label="Clear search"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-3 transition-colors duration-150 hover:bg-surface hover:text-ink"
                >
                  <X size={14} weight="bold" />
                </button>
              )}
            </div>
            {/* Live matches: a listbox under the field. Mouse-down is
                swallowed so the input keeps focus; picking one opens the
                customer drawer directly — the fastest route to a card
                hidden past a column's visible cap. */}
            {suggestOpen && liveQuery && suggestions.length > 0 && (
              <div
                id={suggestListId}
                role="listbox"
                aria-label="Matching customers"
                className="surfaced-lg absolute inset-x-0 top-full z-30 mt-2 p-1.5"
              >
                {suggestions.map((customer, index) => (
                  <button
                    key={customer.id}
                    id={`${suggestListId}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestion}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    onClick={() => pickSuggestion(customer.id)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors duration-150 ${
                      index === activeSuggestion ? "bg-surface-2" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{customer.name}</p>
                      <p className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
                        {[
                          stageLabelByKey.get(customer.stage ?? "") ?? "No stage",
                          segmentNameById.get(customer.segmentId),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Avatar owner={ownerById(customer.ownerId, owners)} size={20} />
                  </button>
                ))}
                {visibleRows.length > suggestions.length && (
                  <p className="border-t border-line-2 px-2.5 pb-1 pt-2 font-mono text-[10px] text-ink-3 tabular-nums">
                    +{visibleRows.length - suggestions.length} more on the board below
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="font-mono text-[11px] text-ink-3 tabular-nums" role="status" aria-live="polite">
            {visibleRows.length} {view === "archive" ? "archived" : "active"}
          </p>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-[1600px] px-7 py-6">
        {view === "board" && (!query || visibleRows.length > 0) ? (
          <KanbanView
            rows={visibleRows}
            stages={stages}
            segments={segments}
            owners={owners}
            contacts={contacts}
            onOpen={open}
            onMoveStage={moveStage}
            onAddStage={addStage}
            onRenameStage={renameStage}
            onArchive={(id) => setArchived(id, true)}
            resultKey={query}
          />
        ) : visibleRows.length > 0 || (view === "list" && !query) ? (
          <ValidationListView
            rows={visibleRows}
            stages={stages}
            segments={segments}
            owners={owners}
            contacts={contacts}
            mode={view === "archive" ? "archive" : "active"}
            resultKey={`${view}:${query}`}
            searchActive={Boolean(query)}
            onOpen={open}
            onMoveStage={moveStage}
            onSetArchived={setArchived}
          />
        ) : (
          <div className="recessed flex flex-col items-start gap-3 px-4 py-5">
            <div>
              <p className="text-[14.5px] font-semibold text-ink">
                {query
                  ? `No ${view === "archive" ? "archived" : "active"} customers match “${search.trim()}”.`
                  : view === "archive"
                    ? "The archive is empty."
                    : "No active customers yet."}
              </p>
              {query ? (
                <p className="mt-1 text-[13px] text-ink-3">
                  Try a customer, contact, owner, segment, or next step.
                </p>
              ) : view === "archive" ? (
                // An empty state teaches the interface: say what the
                // archive is for and where the action lives.
                <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-ink-3">
                  Archiving tucks an account out of the active flow while keeping its full
                  history — use a board card&rsquo;s overflow menu or a list row&rsquo;s archive
                  button. Anything shelved here can be restored to its stage at any time.
                </p>
              ) : null}
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="min-h-10 cursor-pointer rounded-control px-3 text-[13px] font-bold text-accent transition-colors duration-150 hover:bg-accent-soft"
              >
                Clear search
              </button>
            )}
          </div>
        )}
        <CustomerDrawer
          customer={openCustomer}
          stages={stages}
          segments={segments}
          owners={owners}
          contacts={contacts}
          onClose={close}
        />
      </div>
    </>
  );
}
