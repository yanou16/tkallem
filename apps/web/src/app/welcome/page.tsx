"use client";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, Check } from "lucide-react";
import { CONTEXTS, scenarioContext } from "@/components/ScenarioArt";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { ScenarioCard, startHref } from "@/components/cards";
import InstallButton from "@/components/InstallButton";
import HeroExample from "@/features/landing/HeroExample";
import HowItWorks from "@/features/landing/HowItWorks";
import ProductTour from "@/features/landing/ProductTour";
import { GUEST_FREE_ANSWERS } from "@/lib/config";

const FIRST_SCENARIO = "visa-us";
const PRIMARY = "inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

export default function WelcomePage() {
  const { isSignedIn } = useAuth();
  const scenarios = useScenarios();
  const primaryHref = isSignedIn ? "/practice" : "/plan";
  const primaryLabel = isSignedIn ? "Continue practicing" : "Build my speaking plan";
  const list = [...(scenarios.data ?? [])].sort((a, b) => Number(b.id === FIRST_SCENARIO) - Number(a.id === FIRST_SCENARIO) || CONTEXTS.indexOf(scenarioContext(a)) - CONTEXTS.indexOf(scenarioContext(b)));
  return <div className="min-h-dvh bg-white text-ink">
    <header className="flex w-full items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-12 2xl:px-16">
      <Link href="/welcome" className="flex min-h-11 shrink-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold">T</span><span className="text-xl font-semibold tracking-tight">Tkallem</span></Link>
      <nav aria-label="Page" className="flex flex-wrap items-center justify-end gap-1 sm:gap-3">
        <a href="#how" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-black/5 sm:inline-flex">How it works</a>
        <a href="#tour" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-black/5 md:inline-flex">Look inside</a>
        <a href="#situations" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted hover:bg-black/5 sm:inline-flex">Situations</a>
        <Link href={isSignedIn ? "/" : "/sign-in"} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold hover:bg-black/5">{isSignedIn ? "My dashboard" : "Sign in"}</Link>
      </nav>
    </header>
    <main className="w-full px-5 pb-12 sm:px-8 lg:px-12 2xl:px-16">
      <section className="grid items-center gap-10 pb-6 pt-8 lg:grid-cols-2 lg:gap-12 lg:pb-12 lg:pt-14 2xl:gap-20">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full bg-butter/60 px-4 py-2 text-xs font-medium sm:text-sm">For Algerian students · Visa, admission, jobs, IELTS</p>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl 2xl:text-7xl"><span className="text-steel">You know English.</span><br />Stop freezing when you have to speak it.</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg xl:text-xl">Rehearse the real interview out loud with an AI coach that corrects you kindly and explains every mistake in English or French, your choice.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link href={primaryHref} className={PRIMARY}>{primaryLabel} <ArrowRight size={19} aria-hidden="true" /></Link>{!isSignedIn && <Link href={startHref(FIRST_SCENARIO)} className="inline-flex min-h-14 items-center justify-center rounded-full border border-ink px-6 py-4 text-base font-semibold transition-colors hover:bg-black/5">Try a visa interview</Link>}</div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">{["No account needed", `${GUEST_FREE_ANSWERS} free answers`, "Works on your phone"].map((note) => <li key={note} className="flex items-center gap-1.5"><Check size={15} aria-hidden="true" className="text-success" />{note}</li>)}</ul>
        </div>
        <HeroExample />
      </section>

      <div className="mt-16 lg:mt-24"><HowItWorks ctaHref={isSignedIn ? "/practice" : startHref(FIRST_SCENARIO)} ctaLabel={isSignedIn ? "Continue practicing" : "Try a visa interview now"} /></div>
      <div id="tour" className="mt-20 scroll-mt-6 lg:mt-28"><ProductTour /></div>

      <section id="situations" aria-labelledby="situations-title" className="mt-20 scroll-mt-8 lg:mt-28">
        <h2 id="situations-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">Pick a real situation.</h2>
        <p className="mt-3 text-base text-muted sm:text-lg">Five to ten minutes each, with a report on your answers at the end.</p>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {scenarios.isLoading && [0, 1, 2, 3].map((i) => <li key={i} aria-hidden="true" className="h-60 animate-pulse rounded-card bg-black/[0.04]" />)}
          {list.map((scenario) => <li key={scenario.id}><ScenarioCard s={scenario} /></li>)}
        </ul>
        {scenarios.error && <p role="alert" className="mt-4 rounded-2xl bg-butter/40 p-4 text-sm">The scenarios could not be loaded. <Link href={startHref(FIRST_SCENARIO)} className="font-semibold underline">Start the visa interview</Link>.</p>}
      </section>

      <section className="mt-20 flex flex-col items-start justify-between gap-8 rounded-[28px] bg-ink p-7 text-white sm:p-10 lg:mt-28 lg:flex-row lg:items-center lg:p-14">
        <div><h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Your real interview is coming.<br />Rehearse it first.</h2><p className="mt-4 text-base text-white/70 sm:text-lg">Five minutes, your voice, nobody watching.</p></div>
        <div className="flex shrink-0 flex-col items-start gap-4"><Link href={primaryHref} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-white px-7 py-4 text-base font-semibold text-ink hover:bg-white/90">{primaryLabel} <ArrowRight size={19} aria-hidden="true" /></Link><InstallButton className="[&_*]:!text-white" /></div>
      </section>
      <footer className="mt-8 flex flex-col gap-4 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-ink">Tkallem</span><p>Free to try: {GUEST_FREE_ANSWERS} answers without an account. Sign in for 60 more, then 15 new answers every day.</p></footer>
    </main>
  </div>;
}
