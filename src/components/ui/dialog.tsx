"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Confirm dialog with focus trapping, outside-click cancellation, and one
 * clear primary action. Destructive confirmation uses the danger token.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="anim-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4"
      onPointerDown={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
        className="anim-palette-in surfaced-lg w-105 max-w-full p-6"
      >
        <h2 className="font-display text-[30px] font-semibold leading-none text-ink">{title}</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{body}</p>
        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 cursor-pointer border border-transparent px-4 text-[14px] font-semibold text-ink-2 hover:border-line hover:bg-surface-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-10 cursor-pointer px-4 text-[14px] font-semibold text-white ${
              destructive
                ? "bg-danger hover:bg-[#b8462f]"
                : "bg-melt hover:bg-melt-strong"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
