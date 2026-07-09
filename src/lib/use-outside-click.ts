"use client";

import { useEffect } from "react";

/** Closes a menu/dropdown on an outside pointerdown, while it's open. */
export function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active, ref, onOutside]);
}
