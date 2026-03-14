"use client";

import { useRef, useEffect, type ReactNode } from "react";

export default function ScrollFade({
  children,
  className,
  stagger = 0,
  slideDistance = 20,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  slideDistance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.opacity = "1";
      el.style.transform = "translateY(0px)";
      return;
    }

    let ticking = false;
    const staggerPx = stagger * 40;

    function tick() {
      if (!el) return;
      const vh = window.innerHeight;
      const fadeZone = vh * 0.35;
      const rect = el.getBoundingClientRect();

      const enterRaw = (vh - rect.top - staggerPx) / fadeZone;
      const enter = Math.min(Math.max(enterRaw, 0), 1);

      const exitRaw = (rect.bottom + staggerPx) / fadeZone;
      const exit = Math.min(Math.max(exitRaw, 0), 1);

      const tLinear = Math.min(enter, exit);
      const t = tLinear * (2 - tLinear); // ease-out curve

      const y = (1 - t) * slideDistance;
      el.style.opacity = String(t);
      el.style.transform = `translateY(${y}px)`;
      ticking = false;
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(tick);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    tick(); // initial calculation
    return () => window.removeEventListener("scroll", onScroll);
  }, [stagger, slideDistance]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </div>
  );
}
