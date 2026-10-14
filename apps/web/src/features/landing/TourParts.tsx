"use client";
import { createContext, useContext, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** The part of the preview that is lit (null: nothing, everything at full strength). */
export const Lit = createContext<string | null>(null);

/** A part of the preview a caption can point at: lit when its caption is active, the rest fades. */
export function R({ id, className, children, as: Tag = "div" }: { id: string; className?: string; children: ReactNode; as?: "div" | "span" | "p" }) {
  const active = useContext(Lit);
  return (
    <Tag data-region={id}
      className={cn("transition-opacity duration-200", active && active !== id && "opacity-30",
        active === id && "rounded-lg outline outline-2 outline-offset-[3px] outline-ink", className)}>
      {children}
    </Tag>
  );
}

export function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-hairline bg-canvas shadow-[0_16px_48px_-8px_rgba(5,0,56,0.12)]">
      <div className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="size-[11px] rounded-full bg-hairline" />)}</span>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface px-3 py-1 text-[13px] text-slate"><Lock size={12} aria-hidden /> {url}</span>
      </div>
      {children}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full border border-hairline bg-canvas px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}
