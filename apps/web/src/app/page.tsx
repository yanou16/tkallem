import { ArrowRight, Mic } from "lucide-react";
import { ListeningBars } from "@/components/state-indicator";

const scenarios = [
  { title: "Visa interview", time: "8 min", tint: "bg-tint-visa" },
  { title: "Campus France interview", time: "8 min", tint: "bg-tint-campus" },
  { title: "Remote job interview", time: "10 min", tint: "bg-tint-job" },
  { title: "IELTS Speaking, part 2", time: "4 min", tint: "bg-tint-ielts" },
];

export default function Home() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3 bg-ink px-5 py-2 text-small text-canvas">
        Prototype with example data
        <span className="rounded-full bg-brand-yellow px-3 py-0.5 text-caption text-ink">
          Always check the official page
        </span>
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-14">
        <div className="flex items-center gap-2 text-h5">
          <span className="grid size-8 place-items-center rounded-full bg-brand-yellow">
            <Mic size={18} strokeWidth={1.75} />
          </span>
          Tkallem
        </div>
        <button className="rounded-full border border-hairline-strong px-6 py-3 text-small font-medium text-ink">
          Log in
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 md:px-14">
        <section className="grid items-center gap-12 py-12 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="text-h2 text-ink md:text-display">
              Practice the English conversations that matter.
            </h1>
            <p className="mt-4 max-w-md text-body text-slate">
              Speak out loud, get your mistakes corrected in French, and see your progress in numbers. No fear of mistakes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-small font-medium text-canvas">
                Start practicing <ArrowRight size={20} strokeWidth={1.75} />
              </button>
              <span className="rounded-full border border-hairline px-4 py-2 text-caption text-steel">
                Coach at B1
              </span>
            </div>
          </div>

          <div className="rounded-card border border-hairline-soft p-5 md:p-8">
            <div className="max-w-[78%] rounded-bubble bg-surface px-4 py-3 text-body text-ink">
              What is the purpose of your trip?
            </div>
            <div className="mt-4 ml-auto max-w-[78%] rounded-bubble bg-ink px-4 py-3 text-body text-canvas">
              I go to the US for study.
            </div>
            <div className="mt-2 ml-auto max-w-[85%] rounded-correction border border-hairline-soft bg-surface p-4">
              <p className="text-small text-slate">
                I go to the US <s className="text-bad">for study</s>.
              </p>
              <p className="mt-1 text-small font-medium text-ink">
                I go to the US <span className="font-semibold text-good">to study</span>.
              </p>
              <p className="mt-1 text-small text-steel">Le but : to + verbe.</p>
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <ListeningBars />
              <span className="text-small text-slate">Listening…</span>
            </div>
          </div>
        </section>

        <section className="py-8">
          <h2 className="text-h3 text-ink">Pick a situation</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map((s) => (
              <button key={s.title} className={`${s.tint} rounded-card p-5 text-left md:p-6`}>
                <div className="text-h5 text-ink">{s.title}</div>
                <div className="mt-1 text-small text-charcoal">{s.time}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="py-12">
          <div className="grid gap-6 rounded-card bg-ink p-8 text-canvas md:grid-cols-[auto_1fr] md:items-center md:p-10">
            <div className="text-stat">3.2</div>
            <div>
              <div className="text-small text-stone">mistakes per 100 words</div>
              <span className="mt-2 inline-block rounded-full bg-good-fill px-3 py-1 text-caption font-semibold text-canvas">
                -4 in 2 weeks
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 py-10 text-small text-steel md:px-14">
        Tkallem · Thirduni program · Prototype
      </footer>
    </>
  );
}
