"use client";
import { createContext, useContext, type ReactNode } from "react";
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

