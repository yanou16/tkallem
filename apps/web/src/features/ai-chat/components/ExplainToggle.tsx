"use client";
import { cn } from "@/lib/utils";
import type { ExplainLang } from "@/features/auth/types/user";

const OPTIONS: { value: ExplainLang; label: string; short: string }[] = [{ value: "en", label: "English", short: "EN" }, { value: "fr", label: "French", short: "FR" }];

/** "Explain in: English | French": the language of the explanations, always visible on the chat and the report. */
export default function ExplainToggle({ value, onChange, label = "Explain in", disabled, className }: {
  value: ExplainLang; onChange: (lang: ExplainLang) => void; label?: string; disabled?: boolean; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span id="explain-label" className="text-slate">{label}</span>
      <div role="radiogroup" aria-labelledby="explain-label" className="inline-flex rounded-full bg-surface p-0.5">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={disabled} onClick={() => value !== o.value && onChange(o.value)}
            className={cn("min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold disabled:opacity-60 max-[359px]:px-2.5", value === o.value ? "bg-ink text-white" : "text-steel")}>
            <span aria-hidden className="hidden max-[359px]:inline">{o.short}</span><span className="max-[359px]:sr-only">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
