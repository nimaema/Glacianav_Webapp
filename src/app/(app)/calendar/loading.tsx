export default function CalendarLoading() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-[1600px] items-center justify-center px-7 py-12">
      <div className="surfaced flex max-w-md items-center gap-3 px-5 py-4" role="status">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
        <div>
          <p className="text-[15px] font-semibold text-ink">Updating calendars…</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
            Checking published feeds before showing events.
          </p>
        </div>
      </div>
    </div>
  );
}
