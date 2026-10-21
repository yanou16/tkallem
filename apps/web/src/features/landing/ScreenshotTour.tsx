"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SCREENS = {
  home: { label: "Home", src: "/landing/app-home.jpg", text: "Your practice, recent sessions and daily goal in one place." },
  practice: { label: "Practice", src: "/landing/app-practice.jpg", text: "Real situations for interviews, study, travel and everyday life." },
  chat: { label: "AI Chat", src: "/landing/app-chat.jpg", text: "Your answers, the coach’s replies and explanations for your mistakes." },
  groups: { label: "Groups", src: "/landing/app-groups.jpg", text: "Practice with other learners and check your English before sending." },
  progress: { label: "Progress", src: "/landing/app-progress.jpg", text: "Speaking metrics and the mistakes to work on next." },
  profile: { label: "Profile", src: "/landing/app-profile.jpg", text: "Your level, explanation language, learning goals and preferences." },
  plan: { label: "Your plan", src: "/landing/app-plan.jpg", text: "Five short questions to organize your practice around your goals." },
  voice: { label: "Voice", src: "/landing/app-voice.jpg", text: "Speak with your coach and review the corrections from your session." },
} as const;
type Screen = keyof typeof SCREENS;
const PLATFORM: Screen[] = ["home", "practice", "chat", "groups", "progress", "profile"];
const TABS = [{ id: "platform", label: "The platform" }, { id: "plan", label: "Your plan" }, { id: "voice", label: "Voice" }] as const;

/** Real app captures, never a recreated dashboard or simulated call. */
export default function ScreenshotTour() {
  const [tab, setTab] = useState<"platform" | "plan" | "voice">("platform");
  const [page, setPage] = useState<Screen>("home");
  const [failed, setFailed] = useState<string | null>(null);
  const active = SCREENS[tab === "platform" ? page : tab];
  const choose = (id: typeof tab) => { setTab(id); setFailed(null); };
  return <section id="tour" aria-labelledby="tour-title" className="scroll-mt-8">
    <div className="mb-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">Inside Tkallem</p><h2 id="tour-title" className="text-3xl font-bold tracking-tight sm:text-4xl">See how it works.</h2><p className="mt-3 text-base text-muted sm:text-lg">The real screens. The same experience you’ll use.</p></div>
      <div role="tablist" aria-label="Product preview" className="flex w-fit max-w-full gap-1 rounded-full bg-black/[0.04] p-1.5">
        {TABS.map((item) => <button key={item.id} type="button" role="tab" id={`preview-tab-${item.id}`} aria-selected={tab === item.id} aria-controls="screenshot-panel" tabIndex={tab === item.id ? 0 : -1}
          onClick={() => choose(item.id)} onKeyDown={(event) => { const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0; if (!offset && event.key !== "Home" && event.key !== "End") return; event.preventDefault(); const index = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (TABS.findIndex((t) => t.id === tab) + offset + TABS.length) % TABS.length; choose(TABS[index].id); document.getElementById(`preview-tab-${TABS[index].id}`)?.focus(); }}
          className={cn("min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors sm:px-6", tab === item.id ? "bg-ink text-white" : "text-muted hover:bg-white")}>{item.label}</button>)}
      </div>
    </div>
    <div className="overflow-hidden rounded-[28px] border border-line bg-white shadow-soft">
      {tab === "platform" && <nav aria-label="Platform screenshots" className="flex flex-wrap gap-2 border-b border-line p-4 sm:p-5">{PLATFORM.map((key) => <button key={key} type="button" aria-pressed={page === key} onClick={() => { setPage(key); setFailed(null); }} className={cn("min-h-11 rounded-full px-4 text-sm font-medium transition-colors", page === key ? "bg-mint text-ink" : "text-muted hover:bg-black/5")}>{SCREENS[key].label}</button>)}</nav>}
      <div role="tabpanel" id="screenshot-panel" aria-labelledby={`preview-tab-${tab}`} tabIndex={0}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-8"><div><h3 className="font-semibold">{active.label}</h3><p className="mt-1 max-w-3xl text-sm text-muted">{active.text}</p></div>{failed !== active.src && <a href={active.src} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline">View full screenshot <ArrowUpRight size={16} aria-hidden="true" /></a>}</div>
        <div className="relative aspect-[2/1] bg-black/[0.015]">
          {failed === active.src ? <div role="status" className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted">This screenshot is not available yet.</div> : <Image key={active.src} src={active.src} alt={`Actual Tkallem ${active.label} screen. ${active.text}`} fill sizes="(min-width: 1536px) 92vw, 94vw" className="object-contain object-top" onError={() => setFailed(active.src)} />}
        </div>
      </div>
    </div>
    <p className="mt-4 text-sm text-muted">Real app screenshots, cropped to keep personal details private. This preview does not start a call, record audio or use credits.</p>
  </section>;
}
