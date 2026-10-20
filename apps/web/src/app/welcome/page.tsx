"use client";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, MessageCircle, Mic, FileText } from "lucide-react";
import { CONTEXTS, scenarioContext } from "@/components/ScenarioArt";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { ScenarioCard, startHref } from "@/components/cards";

const FIRST_SCENARIO = "visa-us";

/**
 * Public entry page: what a judge or a student sees first when signed out. One primary action, trying a real
 * interview without an account (guest mode, 40 free answers); signing in is secondary.
 */
export default function WelcomePage() {
  const { isSignedIn } = useAuth();
  const scenarios = useScenarios();
  const primaryHref = isSignedIn ? "/practice" : startHref(FIRST_SCENARIO);
  const list = [...(scenarios.data ?? [])].sort((a, b) => CONTEXTS.indexOf(scenarioContext(a)) - CONTEXTS.indexOf(scenarioContext(b)));

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/welcome" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold">T</span>
          <span className="text-xl font-bold tracking-tight">Tkallem</span>
        </Link>
        {isSignedIn ? (
          <Link href="/" className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium">My dashboard</Link>
        ) : (
          <Link href="/sign-in" className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium">Sign in</Link>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-10 py-6 md:grid-cols-[1.1fr_0.9fr] md:py-12">
          <div>
            <p className="text-sm font-medium text-muted">For Algerian students preparing an interview in English</p>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Rehearse your interview in English before the real one.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
              Answer out loud or by typing. Your AI coach plays the visa officer, the Campus France advisor or the
              recruiter, corrects every sentence and explains each mistake in French.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white hover:bg-black/80">
                {isSignedIn ? "Continue practising" : "Try a visa interview now"} <ArrowRight size={18} />
              </Link>
              {!isSignedIn && <p className="text-sm text-muted">No account needed · 40 free answers</p>}
            </div>
          </div>

          {/* A real correction from the coach (correction set, sentence s01), so the value shows before any click. */}
          <figure aria-label="Example of a correction" className="space-y-3 rounded-[28px] bg-black/[0.03] p-5">
            <p className="max-w-[85%] rounded-[20px] bg-white px-4 py-3">What is the purpose of your trip?</p>
            <p className="ml-auto max-w-[85%] rounded-[20px] bg-ink px-4 py-3 text-white">I go to the US for study.</p>
            <div className="ml-auto max-w-[90%] rounded-2xl border border-black/5 bg-white p-3 text-sm">
              <p className="text-muted">I go to the US <s className="text-red-700">for study</s>.</p>
              <p className="font-medium">I go to the US <span className="font-semibold text-emerald-700">to study</span>.</p>
              <p className="mt-1 text-muted">Pour exprimer le but, on utilise to + verbe.</p>
            </div>
          </figure>
        </section>

        <section className="mt-6">
          <h2 className="text-2xl font-semibold">Pick a real situation</h2>
          <p className="mt-1 text-muted">Each one takes 5 to 10 minutes and ends with a report on your answers.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.isLoading && [0, 1, 2].map((i) => <li key={i} className="h-36 animate-pulse rounded-[28px] bg-black/[0.04]" />)}
            {list.map((s) => (
              <li key={s.id}>
                <ScenarioCard s={s} />
              </li>
            ))}
          </ul>
          {scenarios.error && <p className="mt-3 text-sm text-muted">The scenarios could not be loaded. <Link href={startHref(FIRST_SCENARIO)} className="underline">Start the visa interview</Link>.</p>}
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: MessageCircle, title: "1. Choose a situation", text: "A US visa, Campus France, a remote job interview, IELTS speaking." },
            { icon: Mic, title: "2. Answer like on the day", text: "Speak into your phone or type. The coach replies and asks the next question." },
            { icon: FileText, title: "3. Fix what matters", text: "Every mistake explained in French or simple English, then a report with what to redo." },
          ].map(({ icon: I, title, text }) => (
            <div key={title} className="rounded-[28px] border border-black/10 p-5">
              <I size={20} strokeWidth={1.75} />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>

        <p className="mt-10 text-sm text-muted">
          Free to try: 40 answers without an account. Sign in for 60 more, then 15 new answers every day.
        </p>
      </main>
    </div>
  );
}
