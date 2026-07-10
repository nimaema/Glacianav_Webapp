"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Confirm dialog per DESIGN.md §6: surfaced card over a neutral ink scrim,
 * focus trapped, Esc/outside-click cancel, exactly one primary action.
 * Destructive confirms wear --danger, never the brand accent.
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
      className="anim-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,32,43,0.45)] px-4"
      onPointerDown={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(e) => e.stopPropagation()}
        className="anim-palette-in surfaced-lg w-105 max-w-full p-5"
      >
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 cursor-pointer rounded-md px-3.5 text-[14px] font-bold text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 cursor-pointer rounded-md px-4 text-[14px] font-bold text-white transition-colors duration-150 ${
              destructive
                ? "bg-danger hover:bg-[#a53a2f]"
                : "bg-accent hover:bg-accent-strong"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
