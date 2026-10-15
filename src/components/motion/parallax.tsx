"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll-linked depth: moves its children at `speed` × the scroll offset of their section
 * (positive = slower than the page, i.e. further away). Transform-only and rAF-throttled, so it
 * never affects layout or scrolling. Off for reduced motion, and below `minWidth` (phones get a
 * calmer, static composition).
 */
export function Parallax({
  speed,
  children,
  className,
  style,
  minWidth = 768,
  scale = 1,
}: {
  speed: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  minWidth?: number;
  /** Extra scale so edges never show while the layer moves. */
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motionOk = window.matchMedia(`(prefers-reduced-motion: no-preference) and (min-width: ${minWidth}px)`);
    let frame = 0;
    let active = false;

    const update = () => {
      frame = 0;
      const host = el.parentElement ?? el;
      const rect = host.getBoundingClientRect();
      // 0 when the section's top is at the viewport top; grows as it scrolls away.
      const offset = -rect.top;
      el.style.transform = `translate3d(0, ${(offset * speed).toFixed(1)}px, 0) scale(${scale})`;
    };
    // Only does work while the section is on screen.
    const onScroll = () => {
      if (active && !frame) frame = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(([entry]) => {
      active = !!entry?.isIntersecting && motionOk.matches;
      if (active) onScroll();
    });
    io.observe(el.parentElement ?? el);

    const apply = () => {
      if (motionOk.matches) {
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        el.style.transform = "";
      }
    };
    apply();
    motionOk.addEventListener("change", apply);
    return () => {
      io.disconnect();
      motionOk.removeEventListener("change", apply);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [speed, minWidth, scale]);

  return (
    <div ref={ref} data-parallax className={className} style={{ willChange: "transform", ...style }}>
      {children}
    </div>
  );
}
