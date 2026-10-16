"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

const RADIUS = 36; // px, same as the rounded blocks of the landing page

/**
 * The one scroll effect of the landing page: the hero stays in place and the rest of the page slides over it like a card,
 * while the hero shrinks and dims a little behind. Once, between the hero and "How it works".
 * A hero taller than the screen (phones) scrolls until its bottom is on screen, then stays; the card covers it from there.
 * No effect (and no sticky) when the visitor asks for reduced motion, or before the page is measured.
 */
export default function StackIntro({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null); // null: not measured, plain flow

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const heroEl = holder.current, innerEl = inner.current, layerEl = layer.current;
    if (!heroEl || !innerEl || !layerEl) return;
    let raf = 0;

    const measure = () => setTop(Math.min(0, window.innerHeight - heroEl.offsetHeight));
    const paint = () => {
      raf = 0;
      const bottom = heroEl.getBoundingClientRect().bottom;
      const covered = Math.min(1, Math.max(0, 1 - (layerEl.getBoundingClientRect().top + RADIUS) / Math.max(bottom, 1)));
      innerEl.style.transform = `scale(${1 - 0.06 * covered})`;
      innerEl.style.filter = `brightness(${1 - 0.18 * covered})`;
      innerEl.style.borderRadius = `${RADIUS * covered}px`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };

    measure();
    paint();
    const ro = new ResizeObserver(measure);
    ro.observe(heroEl);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="bg-ink">
      <div ref={holder} className={top === null ? undefined : "sticky z-0"} style={top === null ? undefined : { top }}>
        <div ref={inner} className="origin-top overflow-hidden bg-white pb-12 will-change-transform">{hero}</div>
      </div>
      <div ref={layer} className="relative z-10 -mt-9 rounded-t-[36px] bg-white">{children}</div>
    </div>
  );
}
