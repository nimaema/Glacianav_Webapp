/** A quiet, icon-led detail field for dense list rows — deliberately plainer
 * than a status pill so a row full of them doesn't read as a wall of chips. */
export function DetailField({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-2">
      <span className="shrink-0 text-ink-3">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}
