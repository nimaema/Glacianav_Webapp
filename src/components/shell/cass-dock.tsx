"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarCheck, ListChecks, Sparkle, X } from "@phosphor-icons/react";
import {
  conversationsForCustomer,
  customerById,
  detailsFor,
} from "@/lib/fixtures";

type Exchange = { prompt: string; answer: string };

const WORKSPACE_DEMO: Exchange = {
  prompt: "Which hot leads mentioned budget as a blocker?",
  answer:
    "Two: Meridian (04:12) and ArcticOps (18:33). Both cited winter cash flow.",
};

/**
 * The one deep element per screen (DESIGN.md §1): the Cass dock and its
 * panel are the only surfaces that wear the deep pool color. Auto-scoped to
 * context per DESIGN.md §6: on a customer page, Cass narrows to every
 * conversation that customer participates in, wherever it was recorded.
 */
export function CassDock() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const customer = useMemo(() => {
    const m = pathname.match(/^\/customers\/([^/]+)$/);
    return m ? customerById(m[1]) : undefined;
  }, [pathname]);

  const customerConvos = customer ? conversationsForCustomer(customer.id) : [];
  const openTaskCount = customerConvos.reduce(
    (n, c) => n + (detailsFor(c.id)?.actionItems?.filter((a) => a.status === "open").length ?? 0),
    0,
  );

  const demo: Exchange = customer
    ? {
        prompt: `What's still open with ${customer.name}?`,
        answer:
          customerConvos.length > 0
            ? `${openTaskCount} open action item${openTaskCount === 1 ? "" : "s"} across ${customerConvos.length} conversation${customerConvos.length === 1 ? "" : "s"}${
                customer.nextStep ? `. Most recent next step: "${customer.nextStep}".` : "."
              }`
            : `No conversations with ${customer.name} yet — nothing to draw on until the first one is recorded.`,
      }
    : WORKSPACE_DEMO;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <section
          aria-label="Cass assistant"
          className="w-[min(390px,calc(100vw-2rem))] border border-white/15 bg-deep p-5 text-deep-ink shadow-[10px_10px_0_rgba(17,24,19,.22)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkle size={17} className="text-signal" />
              Cass
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[12px] font-medium text-deep-ink-2">
                scope: {customer ? customer.name : "workspace"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Cass"
              className="cursor-pointer rounded p-1 text-deep-ink-2 transition-colors duration-150 hover:text-deep-ink"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mb-2 text-[14px] text-deep-ink-2">
            {customer
              ? `Scoped to every conversation ${customer.name} is a participant in — anywhere it was recorded, not just their page.`
              : "Ask across every conversation and customer you can access."}
          </p>

          {customer && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/15"
              >
                <CalendarCheck size={13} className="text-signal" />
                Draft the next call&rsquo;s agenda
              </button>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12.5px] font-semibold text-deep-ink transition-colors duration-150 hover:bg-white/15"
              >
                <ListChecks size={13} className="text-signal" />
                Turn open items into to-dos
              </button>
            </div>
          )}

          <div className="mb-3 rounded-lg bg-white/8 p-3 text-[14px] leading-relaxed">
            <p className="mb-1 text-deep-ink-2">{demo.prompt}</p>
            <p>{demo.answer}</p>
          </div>

          <label className="sr-only" htmlFor="cass-input">
            Ask Cass
          </label>
          <input
            id="cass-input"
            placeholder={customer ? `Ask Cass about ${customer.name}` : "Ask Cass"}
            className="h-9 w-full rounded-lg bg-white/10 px-3 text-[14.5px] text-deep-ink placeholder:text-deep-ink-2 focus:bg-white/15 focus:outline-none"
          />
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-12 cursor-pointer items-center gap-2 bg-signal px-5 text-[14px] font-bold text-deep shadow-[5px_5px_0_rgba(17,24,19,.2)] transition-transform hover:-translate-y-px"
      >
        <Sparkle size={17} />
        Cass
      </button>
    </div>
  );
}
