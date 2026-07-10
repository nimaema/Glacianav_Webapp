"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  DownloadSimple,
  FileArrowUp,
  FilePdf,
  FileText,
  ListChecks,
  Microphone,
  NotePencil,
  PaperPlaneTilt,
  Sparkle,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useOutsideClick } from "@/lib/use-outside-click";
import type { Customer } from "@/lib/fixtures";
import type { NovaContextData } from "@/lib/data/nova";
import { postQaMessage } from "@/lib/data/library-actions";
import { bulkImportCustomers } from "@/lib/data/customers-actions";

type Exchange = { prompt: string; answer: string };
type NovaTab = "Ask" | "Actions" | "Data";
const TABS: NovaTab[] = ["Ask", "Actions", "Data"];

const QUICK_ACTIONS: { icon: typeof UserPlus; label: string; href: string }[] = [
  { icon: UserPlus, label: "New customer", href: "/customers/new" },
  { icon: UsersThree, label: "New contact", href: "/contacts/new" },
  { icon: NotePencil, label: "New note", href: "/library?new=note" },
  { icon: Microphone, label: "Record a conversation", href: "/record" },
  { icon: ListChecks, label: "Open Work", href: "/work" },
  { icon: CalendarCheck, label: "Find a slot", href: "/calendar" },
];

function mdEscape(s: string) {
  return s.replace(/\|/g, "\\|");
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCustomersMarkdown(customers: Customer[]) {
  const header = "| Name | Segment | Stage | Priority | Website |\n| --- | --- | --- | --- | --- |";
  const rows = customers.map(
    (c) => `| ${mdEscape(c.name)} | ${mdEscape(c.segmentId)} | ${mdEscape(c.stage)} | ${c.priority ?? "-"} | ${c.website ?? "-"} |`,
  );
  const md = `# Customers export\n\n${header}\n${rows.join("\n")}\n`;
  downloadBlob(md, `customers-${new Date().toISOString().slice(0, 10)}.md`, "text/markdown");
}

async function exportCustomersPdf(customers: Customer[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Customers export", 14, 16);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString(), 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [["Name", "Segment", "Stage", "Priority", "Website"]],
    body: customers.map((c) => [c.name, c.segmentId, c.stage, c.priority ?? "-", c.website ?? "-"]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [17, 24, 19] },
  });
  doc.save(`customers-${new Date().toISOString().slice(0, 10)}.pdf`);
}

type ImportRow = {
  name: string;
  segmentName?: string;
  ownerName?: string;
  website?: string;
  priority?: "low" | "medium" | "high";
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

// Column headers are matched case-insensitively against a small set of
// accepted synonyms, so a real prospect list exported from a CRM/sheet
// doesn't need to be reformatted by hand first.
const COLUMN_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["name", "company", "company name", "customer"],
  segmentName: ["segment", "category", "industry"],
  ownerName: ["owner", "lead", "rep"],
  website: ["website", "url", "site"],
  priority: ["priority"],
  contactName: ["contact", "contact name", "person"],
  contactEmail: ["email", "contact email"],
  contactPhone: ["phone", "contact phone"],
};

function normalizeRow(raw: Record<string, unknown>): ImportRow {
  const lower = new Map(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase(), v]));
  const pick = (aliases: string[]) => {
    for (const a of aliases) {
      const v = lower.get(a);
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return undefined;
  };
  const priorityRaw = pick(COLUMN_ALIASES.priority)?.toLowerCase();
  return {
    name: pick(COLUMN_ALIASES.name) ?? "",
    segmentName: pick(COLUMN_ALIASES.segmentName),
    ownerName: pick(COLUMN_ALIASES.ownerName),
    website: pick(COLUMN_ALIASES.website),
    priority: priorityRaw === "low" || priorityRaw === "medium" || priorityRaw === "high" ? priorityRaw : undefined,
    contactName: pick(COLUMN_ALIASES.contactName),
    contactEmail: pick(COLUMN_ALIASES.contactEmail),
    contactPhone: pick(COLUMN_ALIASES.contactPhone),
  };
}

function ImportPanel() {
  const [status, setStatus] = useState<"idle" | "parsing" | "importing" | "done" | "error">("idle");
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatus("parsing");
    setErrorMsg(null);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const rows = raw.map(normalizeRow).filter((r) => r.name);
      if (rows.length === 0) {
        setStatus("error");
        setErrorMsg("No rows with a recognizable Name/Company column were found.");
        return;
      }
      setStatus("importing");
      const outcome = await bulkImportCustomers(rows);
      setResult(outcome);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="sr-only"
        id="nova-import-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <label
        htmlFor="nova-import-file"
        className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/8 px-3 py-2.5 text-[13.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/12"
      >
        <FileArrowUp size={16} className="shrink-0 text-signal" />
        {status === "parsing" || status === "importing" ? "Working…" : "Import customers from Excel/CSV"}
      </label>
      <p className="px-0.5 text-[11.5px] leading-relaxed text-deep-ink-2">
        Columns: Name (required), Segment, Owner, Website, Priority, Contact name/email/phone.
      </p>
      {status === "done" && result && (
        <div className="rounded-lg bg-white/8 px-3 py-2.5 text-[13px]">
          <p className="font-semibold text-deep-ink">{result.created} customer{result.created === 1 ? "" : "s"} created</p>
          {result.skipped.length > 0 && (
            <p className="mt-1 text-[12px] text-deep-ink-2">
              Skipped {result.skipped.length}: {result.skipped.slice(0, 3).join(", ")}
              {result.skipped.length > 3 ? "…" : ""}
            </p>
          )}
        </div>
      )}
      {status === "error" && errorMsg && (
        <p className="rounded-lg bg-[#ff8a75]/10 px-3 py-2.5 text-[12.5px] text-[#ff8a75]">{errorMsg}</p>
      )}
    </div>
  );
}

/**
 * Nova — the workspace assistant dock. Real-data scoped Ask panel, a real
 * quick-action launcher, and real file tools (Excel import → real
 * customers/contacts, Markdown/PDF export of the real customer list).
 */
export function NovaDock({ context, currentUserId }: { context: NovaContextData; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NovaTab>("Ask");
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  useOutsideClick(panelRef, () => setOpen(false), open);

  const [messages, setMessages] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");

  const customer = useMemo(() => {
    const m = pathname.match(/^\/customers\/([^/]+)$/);
    return m ? context.customers.find((c) => c.id === m[1]) : undefined;
  }, [pathname, context.customers]);

  const openTaskCount = customer ? (context.openTaskCountByCustomer[customer.id] ?? 0) : 0;

  const send = () => {
    const q = draft.trim();
    if (!q) return;
    const answer = customer
      ? `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} on ${customer.name}${customer.nextStep ? `. Next step: "${customer.nextStep}".` : "."}`
      : "Live answers over the whole workspace arrive with the capture pipeline and embeddings. This question is saved for when that lands.";
    setMessages((m) => [...m, { prompt: q, answer }]);
    setDraft("");
    void postQaMessage({
      customerId: customer?.id,
      authorId: currentUserId,
      role: "user",
      content: q,
    });
  };

  return (
    <div className="fixed bottom-24 right-3 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6" ref={panelRef}>
      {open && (
        <section
          aria-label="Nova assistant"
          className="flex h-[min(560px,calc(100dvh-7rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col border border-line-2 bg-white text-ink"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 pb-3 pt-4">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkle size={17} className="text-signal" />
              Nova
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-medium text-deep-ink-2">
                scope: {customer ? customer.name : "workspace"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Nova"
              className="cursor-pointer rounded p-1 text-deep-ink-2 transition-colors duration-150 hover:text-deep-ink"
            >
              <X size={16} />
            </button>
          </div>

          <div role="tablist" aria-label="Nova panel" className="flex shrink-0 gap-1 border-b border-white/10 px-4 pt-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-9 cursor-pointer rounded-t-md px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                  tab === t ? "bg-white/10 text-deep-ink" : "text-deep-ink-2 hover:text-deep-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            {tab === "Ask" && (
              <div className="flex min-h-full flex-col">
                <p className="mb-3 text-[13.5px] text-deep-ink-2">
                  {customer
                    ? `Scoped to ${customer.name}, including every conversation and task tied to this account.`
                    : "Ask across every conversation and customer you can access."}
                </p>
                <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
                  {messages.map((m, i) => (
                    <div key={i} className="rounded-lg bg-white/8 p-3 text-[14px] leading-relaxed">
                      <p className="mb-1 text-deep-ink-2">{m.prompt}</p>
                      <p>{m.answer}</p>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <p className="text-[13px] text-deep-ink-2">
                      Nothing asked yet this session. Try &ldquo;What&rsquo;s still open?&rdquo;
                    </p>
                  )}
                </div>
                <div className="mt-3 flex shrink-0 items-center gap-2">
                  <label className="sr-only" htmlFor="nova-input">
                    Ask Nova
                  </label>
                  <input
                    id="nova-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={customer ? `Ask Nova about ${customer.name}` : "Ask Nova"}
                    className="h-9 w-full rounded-lg bg-white/10 px-3 text-[14.5px] text-deep-ink placeholder:text-deep-ink-2 focus:bg-white/15 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={send}
                    aria-label="Send"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-signal text-deep transition-colors duration-150 hover:bg-white"
                  >
                    <PaperPlaneTilt size={15} weight="bold" />
                  </button>
                </div>
              </div>
            )}

            {tab === "Actions" && (
              <div className="flex flex-col gap-1.5">
                <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-deep-ink-2">Quick actions</p>
                {QUICK_ACTIONS.map(({ icon: IconEl, label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/8 px-3 py-2.5 text-[13.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/12"
                  >
                    <IconEl size={16} className="shrink-0 text-signal" />
                    {label}
                  </Link>
                ))}
                {customer && (
                  <>
                    <p className="mb-1.5 mt-3 text-[12px] font-bold uppercase tracking-[0.1em] text-deep-ink-2">
                      On {customer.name}
                    </p>
                    <Link
                      href={`/customers/${customer.id}`}
                      onClick={() => setOpen(false)}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/8 px-3 py-2.5 text-[13.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/12"
                    >
                      <UsersThree size={16} className="shrink-0 text-signal" />
                      Open {customer.name}&rsquo;s room
                    </Link>
                  </>
                )}
              </div>
            )}

            {tab === "Data" && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-deep-ink-2">Import</p>
                  <ImportPanel />
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-deep-ink-2">
                    Export ({context.customers.length} customer{context.customers.length === 1 ? "" : "s"})
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => exportCustomersMarkdown(context.customers)}
                      disabled={context.customers.length === 0}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/8 px-3 py-2.5 text-[13.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FileText size={16} className="shrink-0 text-signal" />
                      Export as Markdown
                      <DownloadSimple size={14} className="ml-auto text-deep-ink-2" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportCustomersPdf(context.customers)}
                      disabled={context.customers.length === 0}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/8 px-3 py-2.5 text-[13.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FilePdf size={16} className="shrink-0 text-signal" />
                      Export as PDF
                      <DownloadSimple size={14} className="ml-auto text-deep-ink-2" />
                    </button>
                  </div>
                  {context.customers.length === 0 && (
                    <p className="mt-1.5 text-[11.5px] text-deep-ink-2">No customers yet. There is nothing to export.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-12 cursor-pointer items-center gap-2 rounded-[14px] bg-melt px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(39,94,231,.24)] hover:bg-melt-strong"
      >
        <Sparkle size={17} />
        Nova
      </button>
    </div>
  );
}
