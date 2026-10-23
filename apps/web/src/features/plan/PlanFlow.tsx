"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useUpdateProfile } from "@/features/profile/hooks/useProfile";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import Choice from "./PlanChoice";
import { startHref } from "@/components/cards";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import {
  EMPTY_PLAN, FOCUS_CHOICES, GOALS, INTEREST_CHOICES, LEVEL_CHOICES, MAX_FOCUS, MINUTE_CHOICES, goalFromLabel, goalLabel, isComplete,
  planPath, saveInterests, toProfileUpdate, toggleFocus, toggleInterest, type PlanAnswers,
} from "./lib/plan";

const STEP_LABELS = ["Your goal", "Your level", "Daily rhythm", "Focus areas", "Your interests"];
const TONES = ["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"];
const ART = ["visa-us", "university-admission", "job-remote", "ielts-part2", "cafe"];
const STEPS = 5;
const SKIP_HREF = startHref("visa-us");

/** One question at a time. The answers are saved in the profile (guests have one too) when the last one is given. */
export default function PlanFlow() {
  const { user } = useCurrentUser();
  const save = useUpdateProfile();
  const scenarios = useScenarios();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<PlanAnswers>(EMPTY_PLAN);
  const done = step >= STEPS;

  const set = (patch: Partial<PlanAnswers>, next = true) => { setA((p) => ({ ...p, ...patch })); if (next) setStep((s) => s + 1); };
  const finish = () => {
    saveInterests(a.interests);
    if (isComplete(a)) save.mutate(toProfileUpdate(a));
    setStep(STEPS);
  };

  if (done) return <Summary a={a} saving={save.isPending} failed={save.isError} retry={() => save.mutate(toProfileUpdate(a))}
    scenarios={scenarios.data ?? []} level={a.level ?? user?.level ?? null} />;

  return (
    <div className="w-full px-1 py-5 sm:px-3 lg:px-6 lg:py-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Your speaking plan</p>
        <span className="rounded-full bg-mint px-4 py-2 text-xs font-medium">A few questions. A plan that fits you.</span>
      </div>
      <div className="mb-5 grid grid-cols-5 gap-2 sm:gap-4" aria-label="Plan steps">{STEP_LABELS.map((label, i) => <div key={label} aria-current={i === step ? "step" : undefined} className="min-w-0">
        <div className={cn("mb-2 h-1.5 rounded-full transition-colors motion-reduce:transition-none", i <= step ? "bg-ink" : "bg-line")} />
        <p className={cn("hidden text-sm sm:block", i === step ? "font-semibold text-ink" : "text-muted")}>{label}</p>
      </div>)}</div>
      <div className="mb-7 flex items-center justify-between text-sm text-muted">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="inline-flex min-h-11 items-center gap-1.5 font-medium disabled:invisible">
          <ArrowLeft size={16} aria-hidden /> Back
        </button>
        <span aria-live="polite">Question {step + 1} of {STEPS}</span>
      </div>


      {step === 0 && (
        <Question title="Why do you need English?" hint="We start with the situations that match your goal.">
          {GOALS.map((g, i) => <Choice tone={TONES[i]} art={ART[i]} key={g.id} selected={a.goal === g.id} onClick={() => set({ goal: g.id })} title={g.label} />)}
        </Question>
      )}
      {step === 1 && (
        <Question title="How is your English when you speak?" hint="No test. It sets how the coach talks to you, and you can change it later.">
          {LEVEL_CHOICES.map((l, i) => <Choice tone={TONES[i]} badge={l.level} key={l.level} selected={a.level === l.level} onClick={() => set({ level: l.level })} title={l.title} text={l.text} />)}
        </Question>
      )}
      {step === 2 && (
        <Question title="How much time can you practice each day?" hint="This becomes your daily goal.">
          <div className="col-span-full grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {MINUTE_CHOICES.map((m) => (
              <Choice key={m} selected={a.minutes === m} onClick={() => set({ minutes: m })} title={`${m} minutes`} tone={TONES[MINUTE_CHOICES.indexOf(m)]} icon="clock" centered />
            ))}
          </div>
        </Question>
      )}
      {step === 3 && (
        <Question title="What is hardest for you?" hint={`Pick up to ${MAX_FOCUS}. The coach will keep them in mind.`}>
          {FOCUS_CHOICES.map((f, i) => (
            <Choice tone={TONES[i % TONES.length]} icon={f.id} key={f.id} selected={a.focus.includes(f.id)} onClick={() => setA((p) => ({ ...p, focus: toggleFocus(p.focus, f.id) }))}
              title={f.label} text={f.text} multi disabled={!a.focus.includes(f.id) && a.focus.length >= MAX_FOCUS} />
          ))}
          <Next disabled={a.focus.length === 0} onClick={() => setStep(4)} />
        </Question>
      )}
      {step === 4 && (
        <Question title="Which subjects do you like?" hint="Optional. They decide which situations come next.">
          <div className="col-span-full grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INTEREST_CHOICES.map((i, index) => (
              <Choice tone={TONES[index]} art={["visa-us", "university-admission", "job-remote", "ielts-part2", "cafe"][index]} key={i.id} selected={a.interests.includes(i.id)} onClick={() => setA((p) => ({ ...p, interests: toggleInterest(p.interests, i.id) }))}
                title={i.label} multi centered />
            ))}
          </div>
          <Next onClick={finish} label="See my plan" />
        </Question>
      )}

      <p className="mt-8 text-center text-sm">
        <Link href={SKIP_HREF} className="inline-flex min-h-11 items-center text-slate underline underline-offset-4">
          Skip, start a visa interview now
        </Link>
      </p>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="plan-q" className="tk-in motion-reduce:animate-none">
      <h1 id="plan-q" className="max-w-4xl text-3xl font-bold tracking-tight leading-tight sm:text-4xl lg:text-5xl">{title}</h1>
      <p className="mb-8 mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">{hint}</p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">{children}</div>
    </section>
  );
}


function Next({ onClick, disabled, label = "Next" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="col-span-full mt-3 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white disabled:opacity-40">
      {label} <ArrowRight size={16} aria-hidden />
    </button>
  );
}

function Summary({ a, saving, failed, retry, scenarios, level }: {
  a: PlanAnswers; saving: boolean; failed: boolean; retry: () => void;
  scenarios: ReturnType<typeof useScenarios>["data"] & object; level: string | null;
}) {
  const path = planPath(scenarios, a.goal, a.interests);
  const first = path[0];
  const focus = FOCUS_CHOICES.filter((f) => a.focus.includes(f.id)).map((f) => f.label);
  return (
    <div className="w-full px-1 py-5 sm:px-3 lg:px-6 lg:py-8">
      <h1 className="max-w-4xl text-3xl font-bold tracking-tight leading-tight sm:text-4xl lg:text-5xl">Your plan</h1>
      <dl className="mb-6 mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-charcoal">
        {a.goal && <><dt className="text-slate">Goal</dt><dd className="font-medium">{goalLabel(a.goal)}</dd></>}
        <dt className="text-slate">Level</dt><dd className="font-medium">{level ?? "B1"}</dd>
        <dt className="text-slate">Daily goal</dt><dd className="font-medium">{a.minutes ?? 10} minutes</dd>
        {focus.length > 0 && <><dt className="text-slate">Working on</dt><dd className="font-medium">{focus.join(", ")}</dd></>}
      </dl>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate">Practice in this order</h2>
      <ol className="flex flex-col gap-3">
        {path.map((s, i) => (
          <li key={s.id}>
            <Link href={startHref(s.id)} className={cn("flex min-h-[64px] items-center gap-4 rounded-card px-4 py-3 text-charcoal", scenarioTint(s.category))}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-sm">{s.minutes ? `${s.minutes} min` : ""}{s.level ? ` · ${s.level}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {first && (
        <Link href={startHref(first.id)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white">
          Start with {first.title} <ArrowRight size={16} aria-hidden />
        </Link>
      )}
      <p className="mt-4 text-sm text-slate" role="status">
        {saving ? "Saving your plan..." : failed ? <>We could not save it. <button type="button" onClick={retry} className="font-semibold underline">Try again</button></> : "Saved. You can change it any time in your profile."}
      </p>
      <p className="mt-1 text-sm text-slate">The situations are the same for everyone: your answers set the order, the level and the daily goal.</p>
    </div>
  );
}
