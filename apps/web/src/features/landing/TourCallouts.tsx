"use client";
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { Callout } from "./tour";

type Line = { id: string; region: string; x1: number; y1: number; x2: number; y2: number };
/** Explanations live outside the miniature; only their labels activate highlights. */
export default function TourCallouts({ callouts, active, onShow, onEngage, stageRef, children }: {
  callouts: Callout[]; active: string | null; onShow: (region: string | null) => void; onEngage: () => void;
  stageRef: RefObject<HTMLDivElement | null>; children: ReactNode;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      if (window.innerWidth < 1024) return setLines([]);
      const bounds = stage.getBoundingClientRect();
      const next: Line[] = [];
      stage.querySelectorAll<HTMLElement>("[data-callout]").forEach((label) => {
        const region = label.dataset.callout!;
        const target = stage.querySelector<HTMLElement>(`[data-region="${region}"]`);
        if (!target) return;
        const from = label.getBoundingClientRect(), to = target.getBoundingClientRect();
        const left = label.dataset.side === "left";
        next.push({ id: `${label.dataset.side}-${region}`, region, x1: (left ? from.right + 6 : from.left - 6) - bounds.left,
          y1: from.top + 18 - bounds.top, x2: (left ? to.left : to.right) - bounds.left, y2: to.top + Math.min(to.height, 40) / 2 - bounds.top });
      });
      setLines(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [stageRef, callouts, active]);
  const label = (item: Callout) => <button key={item.id} type="button" data-callout={item.region} data-side={item.side} aria-pressed={active === item.region}
    onPointerEnter={() => { onEngage(); onShow(item.region); }} onPointerLeave={(event) => { if (event.pointerType === "mouse") onShow(null); }}
    onFocus={() => { onEngage(); onShow(item.region); }} onBlur={() => onShow(null)}
    onClick={() => { onEngage(); onShow(item.region); }}
    className={cn("min-h-11 rounded-xl px-3 py-3 text-sm font-semibold leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink lg:text-base", item.side === "left" ? "lg:text-right" : "text-left", active === item.region && "bg-mint/40")}>
    <span className={cn(active === item.region && "underline underline-offset-4")}>{item.label}</span>
    {active === item.region && <span className="mt-2 block text-sm font-normal text-muted">{item.detail}</span>}
  </button>;
  return <div ref={stageRef} onPointerDown={onEngage} className="relative mt-8 grid gap-5 lg:grid-cols-[minmax(140px,1fr)_minmax(0,4fr)_minmax(140px,1fr)] lg:gap-7">
    <div className="order-first lg:hidden">
      <label htmlFor="tour-feature" className="mb-2 block text-sm font-semibold">Explore a feature</label>
      <select id="tour-feature" value={active ?? ""} onChange={(event) => { onEngage(); onShow(event.target.value || null); }} className="min-h-12 w-full rounded-2xl border border-line bg-white px-3 text-base">
        <option value="">Choose what to explore</option>
        {callouts.map((item) => <option key={item.id} value={item.region}>{item.label}</option>)}
      </select>
      <p aria-live="polite" className="mt-2 min-h-10 text-sm leading-relaxed text-muted">{callouts.find((item) => item.region === active)?.detail ?? "Pick a label to highlight that part of the preview below."}</p>
    </div>
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block">{lines.map((line) => <g key={line.id}>
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={active === line.region ? "#111111" : "#c9cad4"} strokeWidth={active === line.region ? 1.5 : 1} />
      <circle cx={line.x2} cy={line.y2} r={3} fill={active === line.region ? "#111111" : "#c9cad4"} />
    </g>)}</svg>
    <div className="order-2 hidden gap-2 lg:order-none lg:flex lg:flex-col lg:justify-around">{callouts.filter((item) => item.side === "left").map(label)}</div>
    <div className="order-1 min-w-0 lg:order-none">{children}</div>
    <div className="order-3 hidden gap-2 lg:order-none lg:flex lg:flex-col lg:justify-around">{callouts.filter((item) => item.side === "right").map(label)}</div>
  </div>;
}
