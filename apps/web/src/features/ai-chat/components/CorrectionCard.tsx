import { ArrowDown, CircleAlert, Lightbulb } from "lucide-react";
import type { Correction } from "../types/ai";
import { cn } from "@/lib/utils";

/** Shared by the live session and welcome example, with the same correction, colors and explanation. */
export default function CorrectionCard({ c }: { c: Correction }) {
  const grammar = c.type === "grammar";
  return (
    <div className={cn("rounded-2xl p-4", grammar ? "bg-rose" : "bg-butter")}>
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", grammar ? "bg-rose-deep" : "bg-butter-deep")}>
          {grammar ? <CircleAlert size={18} /> : <Lightbulb size={18} />}
        </span>
        {grammar ? "Grammar correction" : "Better phrasing"}
      </p>
      <p className="text-xs font-medium">Your sentence</p>
      <p className="mb-1 rounded-lg bg-rose-deep/60 px-3 py-1.5 text-sm">{c.original}</p>
      <ArrowDown size={14} className="mx-auto my-1" />
      <p className="text-xs font-medium">{grammar ? "Better version" : "More natural"}</p>
      <p className="mb-2 rounded-lg bg-mint-deep/70 px-3 py-1.5 text-sm">{c.fixed}</p>
      <p className="rounded-lg bg-white/60 px-3 py-2 text-xs text-muted">{c.why}</p>
    </div>
  );
}

