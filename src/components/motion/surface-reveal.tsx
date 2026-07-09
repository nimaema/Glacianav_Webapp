"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * The Firn first-load moment: children marked [data-rise] surface with a
 * short staggered lift. Collapses to static under prefers-reduced-motion.
 */
export function SurfaceReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(ref.current!.querySelectorAll("[data-rise]"), {
        y: 14,
        opacity: 0,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.05,
        clearProps: "all",
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
