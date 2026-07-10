export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  // Explicit pixel geometry — track 42×24, knob 18, 3px inset — so the knob
  // can never render off-grid or half-clipped (the old h-4.5 wasn't a real
  // spacing step, which left the knob unsized in some builds). White knob in
  // both states; accent fill = on, matching the app-wide "accent means on"
  // rule (Tabs, rail nav).
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-[rgba(23,32,43,0.22)]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(23,32,43,0.35)] transition-transform duration-150 ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
