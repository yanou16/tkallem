import { Check, Mic, Plane } from "lucide-react";
import { ANSWERS, QUESTION } from "./demo";

/** The hero's picture: one real exchange of a visa interview, as the app shows it (example data, nothing live). Two chips
 *  carry what is new about the product: the wait before speaking, and Say it again. */
export default function HeroExample() {
  const a = ANSWERS[0];
  return (
    <figure aria-label="Example of a corrected answer in a visa interview" className="relative">
      <div className="rounded-[40px] bg-tint-visa p-5 sm:p-8">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-charcoal"><Plane size={14} aria-hidden /> Example: a US visa interview</p>
        <div className="space-y-3 rounded-[28px] bg-white p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-visa" aria-hidden><Plane size={18} /></span>
            <p className="rounded-[20px] bg-surface px-4 py-3 text-base">{QUESTION}</p>
          </div>
          <p className="ml-auto max-w-[88%] rounded-[20px] bg-ink px-4 py-3 text-base text-white">{a.text}</p>
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-1.5 rounded-xl bg-good-bg px-3 py-2 font-medium text-good"><Check size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{a.praise}</span></p>
            <div className="rounded-xl bg-warn-bg px-3 py-2">
              <p className="text-base"><s className="text-charcoal">{a.fix.original}</s> → <span className="font-semibold text-good">{a.fix.fixed}</span></p>
              <p className="mt-0.5 text-sm text-charcoal">{a.fix.why}</p>
            </div>
          </div>
        </div>
      </div>
      {/* On a phone the two proofs sit under the card; from sm up they float on its corners. */}
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2 text-sm font-semibold sm:absolute sm:-top-4 sm:right-8">
          <span className="text-xl font-medium">3.4 s</span> before you speak
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2 text-sm font-semibold sm:absolute sm:-bottom-4 sm:left-8">
          <Mic size={16} aria-hidden /> Say it again → <span className="text-good">Nailed it</span>
        </span>
      </div>
    </figure>
  );
}
