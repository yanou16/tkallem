"use client";
import { createContext, useContext, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** The part of the preview that is lit (null: nothing, everything at full strength). */
export const Lit = createContext<string | null>(null);

/** A part of the preview a caption can point at: lit with an outline when its caption is active. Nothing fades: every
 *  text of the preview keeps its full contrast (an earlier version dimmed the rest to 30% and failed 4.5:1). */
export function R({ id, className, children, as: Tag = "div" }: { id: string; className?: string; children: ReactNode; as?: "div" | "span" | "p" }) {
  const active = useContext(Lit);
  return (
    <Tag data-region={id}
      className={cn(active === id && "rounded-lg outline outline-2 outline-offset-[3px] outline-ink", className)}>
      {children}
    </Tag>
  );
}

export function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="hidden gap-1.5 sm:flex" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="size-[11px] rounded-full bg-hairline" />)}</span>
        <span className="flex min-w-0 flex-1 break-all items-center justify-center gap-1.5 rounded-lg bg-black/[0.025] px-3 py-1 text-[13px] text-slate"><Lock size={12} aria-hidden /> {url}</span>
      </div>
      {children}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full border border-hairline bg-canvas px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}
