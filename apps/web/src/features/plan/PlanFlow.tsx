"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useUpdateProfile } from "@/features/profile/hooks/useProfile";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { ScenarioArt } from "@/components/ScenarioArt";
import { startHref } from "@/components/cards";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import {
  EMPTY_PLAN, FOCUS_CHOICES, GOALS, INTEREST_CHOICES, LEVEL_CHOICES, MAX_FOCUS, MINUTE_CHOICES, goalFromLabel, goalLabel, isComplete,
  planPath, saveInterests, toProfileUpdate, toggleFocus, toggleInterest, type PlanAnswers,
} from "./lib/plan";

const STEP_LABELS = ["Your goal", "Your level", "Daily rhythm", "Focus areas", "Your interests"];
const TONES = ["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"];
const ART = ["visa-us", "campus-france", "job-remote", "ielts-part2", "cafe"];
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
              <Choice tone={TONES[index]} art={["visa-us", "campus-france", "job-remote", "ielts-part2", "cafe"][index]} key={i.id} selected={a.interests.includes(i.id)} onClick={() => setA((p) => ({ ...p, interests: toggleInterest(p.interests, i.id) }))}
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

function Choice({ title, text, selected, onClick, multi, centered, disabled, tone = "bg-mint", art, badge, icon }: {
  tone?: string; art?: string; badge?: string; icon?: "clock" | "fluency" | "confidence" | "grammar" | "vocabulary" | "pronunciation" | "conversation";
  title: string; text?: string; selected: boolean; onClick: () => void; multi?: boolean; centered?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={multi ? selected : undefined}
      className={cn("group relative flex min-h-[142px] w-full items-start gap-4 overflow-hidden rounded-[24px] border-2 border-transparent p-6 text-left text-ink transition duration-200 hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none sm:p-7", tone,
        centered && "min-h-[164px] flex-col",
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
