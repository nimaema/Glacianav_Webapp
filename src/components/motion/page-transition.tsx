"use client";

// Soft route transitions for the main content only. The rail and topbar
// live in the persistent layout, so App Router never remounts them — this
// wraps just the swapped page body and gives it a short fade + lift each
// time the pathname changes, so navigation reads as the active page sliding
// into place rather than a hard content cut. Collapses to a static swap
// under prefers-reduced-motion (DESIGN.md §7).

import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        ref.current,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.26, ease: "power2.out", clearProps: "transform,opacity" },
      );
    },
    { dependencies: [pathname] },
  );

  // Keying on pathname swaps the subtree per route so the animation replays
  // on every navigation, not just first mount.
  return (
    <div key={pathname} ref={ref} className="min-h-full">
      {children}
    </div>
  );
}
