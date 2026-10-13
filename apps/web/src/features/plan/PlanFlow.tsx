"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useUpdateProfile } from "@/features/profile/hooks/useProfile";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { startHref } from "@/components/cards";
import { Icon } from "@/lib/icons";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import {
  EMPTY_PLAN, FOCUS_CHOICES, GOALS, INTEREST_CHOICES, LEVEL_CHOICES, MAX_FOCUS, MINUTE_CHOICES, goalFromLabel, goalLabel, isComplete,
  planPath, saveInterests, toProfileUpdate, toggleFocus, toggleInterest, type PlanAnswers,
} from "./lib/plan";

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
    <div className="mx-auto max-w-xl pt-2 md:pt-6">
      <div className="flex items-center justify-between text-sm text-slate">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="inline-flex min-h-11 items-center gap-1.5 font-medium disabled:invisible">
          <ArrowLeft size={16} aria-hidden /> Back
        </button>
        <span aria-live="polite">Question {step + 1} of {STEPS}</span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-hairline" aria-hidden>
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
      </div>

      {step === 0 && (
        <Question title="Why do you need English?" hint="We start with the situations that match your goal.">
          {GOALS.map((g) => <Choice key={g.id} selected={a.goal === g.id} onClick={() => set({ goal: g.id })} title={g.label} />)}
        </Question>
      )}
      {step === 1 && (
        <Question title="How is your English when you speak?" hint="No test. It sets how the coach talks to you, and you can change it later.">
          {LEVEL_CHOICES.map((l) => <Choice key={l.level} selected={a.level === l.level} onClick={() => set({ level: l.level })} title={l.title} text={l.text} />)}
        </Question>
      )}
      {step === 2 && (
        <Question title="How much time can you practise each day?" hint="This becomes your daily goal.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MINUTE_CHOICES.map((m) => (
              <Choice key={m} selected={a.minutes === m} onClick={() => set({ minutes: m })} title={`${m} minutes`} centered />
            ))}
          </div>
        </Question>
      )}
      {step === 3 && (
        <Question title="What is hardest for you?" hint={`Pick up to ${MAX_FOCUS}. The coach will keep them in mind.`}>
          {FOCUS_CHOICES.map((f) => (
            <Choice key={f.id} selected={a.focus.includes(f.id)} onClick={() => setA((p) => ({ ...p, focus: toggleFocus(p.focus, f.id) }))}
              title={f.label} text={f.text} multi disabled={!a.focus.includes(f.id) && a.focus.length >= MAX_FOCUS} />
          ))}
          <Next disabled={a.focus.length === 0} onClick={() => setStep(4)} />
        </Question>
      )}
      {step === 4 && (
        <Question title="Which subjects do you like?" hint="Optional. They decide which situations come next.">
          <div className="grid grid-cols-2 gap-3">
            {INTEREST_CHOICES.map((i) => (
              <Choice key={i.id} selected={a.interests.includes(i.id)} onClick={() => setA((p) => ({ ...p, interests: toggleInterest(p.interests, i.id) }))}
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
    <section aria-labelledby="plan-q">
      <h1 id="plan-q" className="text-2xl font-medium leading-tight md:text-3xl">{title}</h1>
      <p className="mb-5 mt-2 text-slate">{hint}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Choice({ title, text, selected, onClick, multi, centered, disabled }: {
  title: string; text?: string; selected: boolean; onClick: () => void; multi?: boolean; centered?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={multi ? selected : undefined}
      className={cn("flex min-h-[56px] w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition disabled:opacity-40",
        centered && "justify-center text-center",
        selected ? "border-ink bg-surface" : "border-hairline bg-canvas hover:border-ink/40")}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {text && <span className="block text-sm text-slate">{text}</span>}
      </span>
      {multi && selected && <Check size={18} aria-hidden />}
    </button>
  );
}

function Next({ onClick, disabled, label = "Next" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white disabled:opacity-40">
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
    <div className="mx-auto max-w-xl pt-2 md:pt-6">
      <h1 className="text-2xl font-medium leading-tight md:text-3xl">Your plan</h1>
      <dl className="mb-6 mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-charcoal">
        {a.goal && <><dt className="text-slate">Goal</dt><dd className="font-medium">{goalLabel(a.goal)}</dd></>}
        <dt className="text-slate">Level</dt><dd className="font-medium">{level ?? "B1"}</dd>
        <dt className="text-slate">Daily goal</dt><dd className="font-medium">{a.minutes ?? 10} minutes</dd>
        {focus.length > 0 && <><dt className="text-slate">Working on</dt><dd className="font-medium">{focus.join(", ")}</dd></>}
      </dl>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate">Practise in this order</h2>
      <ol className="flex flex-col gap-3">
        {path.map((s, i) => (
          <li key={s.id}>
            <Link href={startHref(s.id)} className={cn("flex min-h-[64px] items-center gap-4 rounded-card px-4 py-3 text-charcoal", scenarioTint(s.category))}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-sm">{s.minutes ? `${s.minutes} min` : ""}{s.level ? ` · ${s.level}` : ""}</span>
              </span>
              <Icon name={s.icon ?? undefined} size={22} />
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
