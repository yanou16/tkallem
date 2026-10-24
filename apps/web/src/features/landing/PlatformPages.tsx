"use client";
import Miniature from "./Miniature";
import ProgressView from "@/features/progress/components/ProgressView";
import ProfileView from "@/features/profile/components/ProfileView";
import { PREVIEW_PROGRESS, PREVIEW_BADGES } from "./previewData";
import { useState } from "react";
import { Check, Lightbulb, Mic, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { GOALS, planOrder } from "@/features/plan/lib/plan";
import { ScenarioCard } from "@/components/cards";
import { Browser, Pill, R } from "./TourParts";
import { DEMO_SCENARIOS, PAGES, menuOf, planView, type DemoScenario, type PlanDemo, type PlatformPage } from "./tour";

const URL: Record<PlatformPage, string> = {
  home: "tkallem.vercel.app", practice: "tkallem.vercel.app/practice", chat: "tkallem.vercel.app/ai-chat",
  progress: "tkallem.vercel.app/progress", profile: "tkallem.vercel.app/profile",
};

function Ring({ done, goal }: { done: number; goal: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--hairline-soft)" strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${c * Math.min(done / goal, 1)} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

const Box = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("rounded-2xl border border-hairline p-3", className)}>{children}</div>;
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between border-t border-hairline-soft py-1.5 text-xs first:border-0">{k}<b className="text-slate">{v}</b></div>;
const Head = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="mb-3"><span className="text-xs text-slate">{eyebrow}</span><h3 className="text-[24px] font-bold leading-tight tracking-tight">{title}</h3></div>
);

function Card({ s, i, real, onOpen }: { s: DemoScenario; i?: number; real?: boolean; onOpen: () => void }) {
  return <div className="relative">
    {i !== undefined && <span className="absolute right-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-xs font-semibold">{i + 1}</span>}
    <R id={real ? "real" : `scenario-${s.id}`}>
      <ScenarioCard s={{ ...s, totalQuestions: s.mode === "free" ? null : 6, description: null, icon: null }} compact onStart={onOpen} />
    </R>
  </div>;
}

/* ---------- the pages ---------- */
function Home({ plan, open }: { plan: PlanDemo; open: () => void }) {
  const v = planView(plan);
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate">Salam User · {v.level}</span>
        <R id="credits" as="span"><Pill className="inline-flex items-center gap-1"><Zap size={12} aria-hidden /> 33 credits</Pill></R>
      </div>
      <h3 className="mb-3 text-[24px] font-bold leading-tight tracking-tight">Ready for {v.minutes} minutes of speaking?</h3>
      <R id="kpi" className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[["Mistakes per 100 words", "12.4", "↓ 3.1"], ["Practice this week", "42 min", ""], ["Streak", "3 days", ""]].map(([k, val, d], i) => (
          <div key={k} className={cn("rounded-2xl p-3", ["bg-ink text-white", "bg-mint", "bg-butter"][i])}><span className={cn("block text-xs", i === 0 ? "text-white/80" : "text-muted")}>{k}</span><b className="text-xl font-medium">{val}</b>{d && <em className="ml-1 text-xs font-semibold not-italic text-good">{d}</em>}</div>
        ))}
      </R>
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <div>
          <R id="plan" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Your plan, in order</R>
          <R id="situations" className="grid grid-cols-1 gap-2 sm:grid-cols-2">{v.path.map((s, i) => <Card key={s.id} s={s} i={i} real={i === 1} onOpen={open} />)}</R>
        </div>
        <div className="space-y-2.5">
          <R id="goal"><Box><h4 className="mb-2 text-[13px] font-semibold">Today&apos;s goal</h4>
            <div className="flex items-center gap-2.5"><Ring done={6} goal={v.minutes} /><div><b className="text-base">6 / {v.minutes} min</b><div className="text-xs text-slate">Practice today</div></div></div></Box></R>
          <R id="mistakes"><Box><h4 className="mb-1 text-[13px] font-semibold">Your top mistakes</h4><Row k="Verb tense" v="5×" /><Row k="Articles" v="3×" /></Box></R>
          <R id="recent"><Box><h4 className="mb-1 text-[13px] font-semibold">Recent sessions</h4><Row k="Visa interview" v="2 h ago" /><Row k="At the airport" v="Mon" /></Box></R>
        </div>
      </div>
    </>
  );
}

function Practice({ plan, open }: { plan: PlanDemo; open: () => void }) {
  const v = planView(plan);
  const all = planOrder(DEMO_SCENARIOS, v.goal, plan.interests).slice(0, 6);
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <Head eyebrow={`Practice · ${v.level}`} title="Choose your next practice" />
        <R id="planlink" as="span" className="mt-1 whitespace-nowrap text-xs font-semibold underline">Your plan</R>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_170px]">
        <R id="grid" className="grid grid-cols-1 gap-2 sm:grid-cols-2">{all.map((s, i) => <Card key={s.id} s={s} real={i === 0 ? true : undefined} onOpen={open} />)}</R>
        <R id="recent"><Box><h4 className="mb-1 text-[13px] font-semibold">Recent sessions</h4><Row k="Visa interview" v="2 h ago" /><Row k="At the airport" v="Mon" /><Row k="Taking a taxi" v="Sun" /></Box></R>
      </div>
    </>
  );
}

function Chat() {
  const [real, setReal] = useState(false);
  const [helped, setHelped] = useState(false);
  return (
    <div className="flex min-h-[420px] flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <Pill>Visa interview</Pill>
        <R id="mode" as="span" className="inline-flex rounded-full bg-surface p-[3px] text-xs font-semibold">
          {[["Practice", false], ["Real interview", true]].map(([l, r]) => (
            <button key={String(l)} type="button" onClick={() => setReal(r as boolean)} aria-pressed={real === r}
              className={cn("min-h-11 rounded-full px-3 md:min-h-8", real === r ? "bg-ink text-white" : "text-slate")}>{l}</button>
          ))}
        </R>
      </div>
      <R id="question" className="max-w-[78%] self-start rounded-[20px] rounded-bl-md bg-surface px-3.5 py-2.5">What is the purpose of your trip?</R>
      <p className="max-w-[78%] self-end rounded-[20px] rounded-br-md bg-ink px-3.5 py-2.5 text-white">I go to US for study my master.</p>
      <R id="feedback" className="flex flex-col items-end gap-2">
        {real ? (
          <p className="max-w-[84%] rounded-xl bg-surface px-3 py-2 text-slate">Thank you. Nothing is shown until the report, like the real interview.</p>
        ) : (
          <>
            <p className="max-w-[84%] rounded-xl bg-good-bg px-3 py-2 font-semibold text-good"><Check size={13} className="mr-1 inline" aria-hidden />Clear purpose: “study my master”.</p>
            <p className="max-w-[84%] rounded-2xl border border-hairline bg-warn-bg px-3 py-2"><s className="text-bad">I go to US for study my master</s> → <b className="text-good">I am going to the US to study for my master’s</b>
              <small className="mt-1 block text-slate">Use “to + verb” for a purpose, and add “the” before US.</small></p>
          </>
        )}
      </R>
      {!real && <R id="again" className="self-end"><button type="button" className="min-h-11 md:min-h-9 rounded-full bg-ink px-4 text-xs font-semibold text-white">Say it again</button></R>}
      {real && <R id="again" className="self-end text-xs text-slate">Say it again opens in the report</R>}
      {helped && <p className="rounded-xl bg-surface px-3 py-2 text-xs">You can start with: <b>The main purpose of my trip is to…</b></p>}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <R id="help"><button type="button" onClick={() => setHelped((h) => !h)} className="inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-full border border-hairline-strong px-3 text-xs font-semibold"><Lightbulb size={13} aria-hidden /> Help me start</button></R>
        <R id="answer" className="flex min-w-0 flex-1 items-center gap-2"><span className="flex-1 rounded-full border border-hairline px-3.5 py-2.5 text-stone">Type or speak your answer…</span>
          <span className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><Mic size={18} aria-hidden /></span></R>
      </div>
    </div>
  );
}

function Progress() {
  return <Miniature><ProgressView q={{ data: PREVIEW_PROGRESS, isLoading: false, error: null, refetch: () => {} }} /></Miniature>;
}
function Profile({ plan }: { plan: PlanDemo }) {
  const v = planView(plan);
  return <Miniature><ProfileView user={{ firstName: "User", email: "", level: v.level, explainLang: "en", dailyGoalMinutes: v.minutes, learningGoal: GOALS.find((g) => g.id === v.goal)?.label ?? null, practiceMode: "both", focusAreas: ["fluency"] }}
    sessions={{ data: [], isLoading: false, error: null, refetch: () => {} }}
    achievements={{ data: PREVIEW_BADGES, isLoading: false, error: null, refetch: () => {} }} /></Miniature>;
}

/* ---------- the app: a sidebar that works ---------- */
export default function Platform({ plan, page, onPage }: { plan: PlanDemo; page: PlatformPage; onPage: (p: PlatformPage) => void }) {
  return (
    <Browser url={URL[page]}>
      <div className="grid min-h-[600px] grid-cols-1 text-[13px] md:grid-cols-[132px_1fr]">
        <aside className="hidden flex-col gap-1 border-r border-hairline-soft p-3 md:flex">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold" aria-hidden><b className="flex size-[26px] items-center justify-center rounded-lg bg-brand-yellow text-[13px]">T</b>Tkallem</div>
          <R id="nav" className="flex flex-col gap-1" >
            {PAGES.map((p) => (
              <button key={p.id} type="button" onClick={() => onPage(p.id)} aria-current={menuOf(page) === p.id ? "page" : undefined}
                className={cn("min-h-11 rounded-full px-2.5 text-left font-medium", menuOf(page) === p.id ? "bg-ink text-white" : "text-slate hover:bg-surface")}>{p.label}</button>
            ))}
          </R>
        </aside>
        <div className="min-w-0 p-4 md:p-5">
          <nav aria-label="Pages" className="mb-3 flex gap-1 overflow-x-auto md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PAGES.map((p) => (
              <button key={p.id} type="button" onClick={() => onPage(p.id)} aria-current={menuOf(page) === p.id ? "page" : undefined}
                className={cn("min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold", menuOf(page) === p.id ? "bg-ink text-white" : "bg-surface text-slate")}>{p.label}</button>
            ))}
          </nav>
          {page === "home" && <Home plan={plan} open={() => onPage("chat")} />}
          {page === "practice" && <Practice plan={plan} open={() => onPage("chat")} />}
          {page === "chat" && <Chat />}
          {page === "progress" && <Progress />}
          {page === "profile" && <Profile plan={plan} />}
        </div>
      </div>
    </Browser>
  );
}
