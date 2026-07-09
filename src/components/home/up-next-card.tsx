import Link from "next/link";
import { Record } from "@phosphor-icons/react/dist/ssr";
import { upNext } from "@/lib/fixtures";

export function UpNextCard() {
  return (
    <section data-rise aria-label="Up next" className="surfaced risen px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-melt">
            {upNext.label}
          </p>
          <h2 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.01em] text-ink">
            {upNext.title}
          </h2>
          <p className="truncate text-[14.5px] text-ink-3">{upNext.sub}</p>
        </div>
        <span className="font-mono text-[22px] font-bold leading-none text-ink tabular-nums">
          {upNext.time}
        </span>
      </div>

      <p className="recessed mt-3 px-3 py-2 text-[14px] leading-relaxed text-ink-2">
        {upNext.prep}
      </p>

      <div className="mt-3.5 flex items-center gap-2">
        <Link
          href={`/record?c=${upNext.customerId}`}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-melt px-4 text-[14px] font-bold text-white transition-colors duration-150 hover:bg-melt-strong"
        >
          <Record size={18} />
          Record
        </Link>
        <Link
          href={`/customers/${upNext.customerId}`}
          className="h-9 cursor-pointer rounded-md border border-melt/60 px-3.5 text-[14px] font-bold leading-9 text-melt transition-colors duration-150 hover:bg-melt/10"
        >
          Open customer page
        </Link>
      </div>
    </section>
  );
}
