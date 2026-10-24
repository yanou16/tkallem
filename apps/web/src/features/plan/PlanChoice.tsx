"use client";
import { Check } from "lucide-react";
import { ScenarioArt } from "@/components/ScenarioArt";
import { cn } from "@/lib/utils";
export default function PlanChoice({ title, text, selected, onClick, multi, centered, disabled, compact = false, tone = "bg-mint", art, badge, icon }: {
  compact?: boolean; tone?: string; art?: string; badge?: string; icon?: "clock" | "fluency" | "confidence" | "grammar" | "vocabulary" | "pronunciation" | "conversation";
  title: string; text?: string; selected: boolean; onClick: () => void; multi?: boolean; centered?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={multi ? selected : undefined}
      className={cn("group relative flex w-full items-start gap-4 overflow-hidden rounded-[24px] border-2 border-transparent p-6 text-left text-ink transition duration-200 hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none sm:p-7", tone,
        compact ? "min-h-[64px] !p-4" : "min-h-[142px]",
        centered && !compact && "min-h-[164px] flex-col",
        selected && "border-ink")}>
      {badge && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-sm font-bold">{badge}</span>}
      {icon && <PlanArt name={icon} tone={tone} minutes={icon === "clock" ? Number.parseInt(title) : undefined} />}
      {art && <span className="pointer-events-none absolute inset-0 opacity-30"><ScenarioArt scenario={{ id: art, mode: "guided", category: art === "job-remote" ? "work" : art === "campus-france" ? "study" : art === "ielts-part2" ? "exams" : "daily_life" }} /></span>}
      <span className={cn("relative z-10 min-w-0 flex-1", (art || (icon && icon !== "clock")) && "pr-16")}>
        <span className="block text-base font-semibold sm:text-lg">{title}</span>
        {text && <span className="mt-2 block text-sm leading-relaxed text-muted">{text}</span>}
      </span>
      {selected && <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white"><Check size={14} aria-hidden /></span>}
    </button>
  );
}

/** Object-only line drawings, matching the quiet artwork on scenario cards. */
function PlanArt({ name, tone, minutes }: { name: string; tone: string; minutes?: number }) {
  const ink = ({ "bg-rose": "text-[#a24e5b]", "bg-mint": "text-[#34796d]", "bg-peach": "text-[#9b573b]", "bg-lilac": "text-[#706090]", "bg-butter": "text-[#927027]" } as Record<string, string>)[tone];
  return <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    className={cn("pointer-events-none absolute bottom-3 right-4 h-24 w-24 select-none opacity-[0.16]", ink)}>
    {name === "clock" && <><circle cx="51" cy="53" r="31" /><path d="M44 12h14M51 12v9M75 23l7 7M29 24l-7 7" /><path d="M51 33v20l15 9" /><circle cx="51" cy="53" r="2" />{minutes && <path d="M51 22a31 31 0 0 1 30 23" strokeWidth={minutes >= 20 ? 4 : 2} />}</>}
    {name === "fluency" && <><path d="M18 22h63v44H43L25 82V66h-7z" /><path d="M43 34v20M57 34v20" /></>}
    {name === "confidence" && <><path d="M17 20h66v45H43L25 81V65h-8z" strokeDasharray="5 5" /><path d="M40 36c0-11 20-11 20 0 0 7-10 7-10 14M50 57h.1" /><path d="M49 81h.1" /></>}
    {name === "grammar" && <><path d="M16 28h68M16 45h27M16 66h46" /><path d="M52 41l7 7 13-16M39 25l8-9M39 25l9 5M30 75h43" /><path d="M29 62l8 8 17-19" /></>}
    {name === "vocabulary" && <><rect x="13" y="23" width="73" height="56" rx="8" /><text x="50" y="60" textAnchor="middle" stroke="none" fill="currentColor" fontSize="27" fontFamily="sans-serif" fontWeight="500">ABC</text><path d="M25 15h49M25 87h49" /></>}
    {name === "pronunciation" && <><circle cx="33" cy="29" r="14" /><path d="M11 83V70c0-15 10-24 22-24 13 0 23 9 23 24v13M56 29c7 5 7 13 0 18M67 20c14 10 14 26 0 36M78 12c21 15 21 37 0 53" /></>}
    {name === "conversation" && <><path d="M10 17h49v30H32L20 58V47H10zM43 57h47v28H77L65 95V85H43z" /><path d="M23 32h22M55 71h22M69 23c15 2 19 10 16 22M80 40l5 5 6-5M30 78C15 78 9 70 12 62M7 66l5-5 5 5" /></>}

  </svg>;
}
