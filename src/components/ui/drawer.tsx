"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Right overlay drawer: quick view over the workspace, per DESIGN.md §6.
 * Focus is trapped while open; Esc and scrim click close. The panel is a
 * floating surfaced object, not an edge-flush sheet.
 */
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? panel).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="anim-overlay-in fixed inset-0 z-40 bg-[rgba(23,32,43,0.35)]"
      onPointerDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        className="anim-drawer-in surfaced-lg absolute inset-y-3 right-3 flex w-120 max-w-[calc(100vw-24px)] flex-col overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}
