import { MessageCircle, Plane } from "lucide-react";
import CorrectionCard from "@/features/ai-chat/components/CorrectionCard";

/** Real live-correction component with clearly labelled example content. */
export default function HeroExample() {
  return <figure aria-label="Example conversation and live correction" className="rounded-[28px] bg-mint/40 p-5 sm:p-8 xl:p-10">
    <figcaption className="mb-6 flex items-center gap-2 text-sm font-medium text-ink/70"><Plane size={17} aria-hidden="true" /> Example: a US visa interview</figcaption>
    <div className="space-y-5">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white"><MessageCircle size={19} aria-hidden="true" /></span><p className="rounded-2xl bg-white px-5 py-4 text-sm sm:text-base">What is the purpose of your trip?</p></div>
      <p className="ml-auto max-w-[85%] rounded-2xl bg-mint px-5 py-4 text-sm sm:text-base">I go to the US for study.</p>
      <div className="ml-auto max-w-md"><CorrectionCard c={{original: "for study", fixed: "to study", type: "grammar", why: "Pour exprimer le but, on utilise to + verbe."}} /></div>
    </div>
    <p className="mt-5 text-right text-xs text-muted">Example content. Same feedback as in your conversation.</p>
  </figure>;
}
