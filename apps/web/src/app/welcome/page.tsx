"use client";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowDown, ArrowRight, Check, Clock } from "lucide-react";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { startHref } from "@/components/cards";
import InstallButton from "@/components/InstallButton";
import HeroExample from "@/features/landing/HeroExample";
import ProductDemo from "@/features/landing/ProductDemo";
import { Icon } from "@/lib/icons";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";

const FIRST_SCENARIO = "visa-us";
const HIDDEN_HERE = new Set(["visa-business"]); // a second visa card next to the first one: still on the Practice page

/**
 * Public entry page: what a judge or a student sees first when signed out. One message (you understand English, you freeze
 * when you have to speak it), one picture, one action: try a real interview without an account (guest mode, 40 free
 * answers). Then the guided tour, the situations, and a last call to action. Air between the parts, nothing said twice.
 */
export default function WelcomePage() {
  const { isSignedIn } = useAuth();
  const scenarios = useScenarios();
  const primaryHref = isSignedIn ? "/practice" : startHref(FIRST_SCENARIO);
  const list = [...(scenarios.data ?? [])]
    .filter((s) => !HIDDEN_HERE.has(s.id))
    .sort((a, b) => Number(b.id === FIRST_SCENARIO) - Number(a.id === FIRST_SCENARIO));

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/welcome" className="flex min-h-11 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold">T</span>
          <span className="text-xl font-bold tracking-tight">Tkallem</span>
        </Link>
        <nav aria-label="Page" className="flex items-center gap-1 sm:gap-3">
          <a href="#how" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-medium text-charcoal hover:bg-surface sm:inline-flex">How it works</a>
          <a href="#situations" className="hidden min-h-11 items-center rounded-full px-4 text-sm font-medium text-charcoal hover:bg-surface sm:inline-flex">Situations</a>
          {isSignedIn ? (
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-black/15 px-5 text-sm font-medium">My dashboard</Link>
          ) : (
            <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full border border-black/15 px-5 text-sm font-medium">Sign in</Link>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        {/* hero */}
        <section className="grid items-center gap-14 pb-4 pt-8 md:pb-10 md:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <p className="inline-flex rounded-full bg-surface px-4 py-2 text-sm font-medium text-charcoal">
              For Algerian students: visa, Campus France, jobs, IELTS
            </p>
            <h1 className="mt-6 text-[2.5rem] font-medium leading-[1.05] tracking-tight sm:text-6xl">
              You know English.<br />
              <span className="text-steel">Stop freezing when you have to speak it.</span>
            </h1>
            <p className="mt-6 max-w-lg text-xl leading-relaxed text-charcoal">
              Rehearse the real interview out loud with an AI coach that corrects you kindly and explains every mistake in French.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-8 py-4 text-lg font-semibold text-white hover:bg-black/80">
                {isSignedIn ? "Continue practising" : "Try a visa interview now"} <ArrowRight size={20} />
              </Link>
              <a href="#how" className="inline-flex min-h-11 items-center justify-center gap-2 px-2 text-base font-semibold underline underline-offset-4">
                See how it works <ArrowDown size={16} aria-hidden />
              </a>
            </div>
            {!isSignedIn && (
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-charcoal">
                {["No account needed", "40 free answers", "Works on your phone"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><Check size={16} className="text-good" aria-hidden /> {t}</li>
                ))}
              </ul>
            )}
          </div>
          <HeroExample />
        </section>

        <div id="how" className="mt-24 scroll-mt-6 md:mt-32"><ProductDemo /></div>

        <section id="situations" className="mt-24 scroll-mt-6 md:mt-32">
          <h2 className="text-2xl font-semibold sm:text-3xl">Pick a real situation</h2>
          <p className="mt-2 max-w-xl text-lg text-charcoal">Five to ten minutes each, and a report at the end.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.isLoading && [0, 1, 2].map((i) => <li key={i} className="h-44 animate-pulse rounded-[28px] bg-black/[0.04]" />)}
            {list.map((s) => (
              <li key={s.id}>
                <Link href={startHref(s.id)} className={cn("group flex h-full min-h-44 flex-col justify-between gap-6 rounded-[28px] p-6 hover:opacity-90", scenarioTint(s.category))}>
                  <span className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70"><Icon name={s.icon ?? undefined} size={24} /></span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white" aria-hidden><ArrowRight size={18} /></span>
                  </span>
                  <span>
                    <span className="block text-xl font-semibold">{s.title}</span>
                    <span className="mt-1 line-clamp-2 block text-base text-charcoal">{s.description}</span>
                    <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-charcoal"><Clock size={14} aria-hidden /> {s.minutes ?? 10} min{s.level ? ` · ${s.level}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {scenarios.error && <p className="mt-3 text-sm text-muted">The scenarios could not be loaded. <Link href={startHref(FIRST_SCENARIO)} className="underline">Start the visa interview</Link>.</p>}
        </section>

        {/* last call to action */}
        <section className="mt-24 rounded-[36px] bg-ink px-6 py-14 text-center text-white sm:px-12 md:mt-32 md:py-20">
          <h2 className="mx-auto max-w-xl text-3xl font-medium tracking-tight sm:text-4xl">Your real interview is coming. Rehearse it first.</h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-white/75">Five minutes, your voice, nobody watching.</p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-ink hover:bg-white/90">
              {isSignedIn ? "Continue practising" : "Try a visa interview now"} <ArrowRight size={20} />
            </Link>
            <InstallButton className="[&_*]:!text-white" />
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-muted">
          Free to try: 40 answers without an account. Sign in for 60 more, then 15 new answers every day.
        </p>
      </main>
    </div>
  );
}
