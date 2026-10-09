"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Clock } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { usePracticeFocus, useRecentSessions, useRecommended, useScenarios } from "@/features/practice/hooks/usePractice";
import { Async, Card, EmptyState, PageHeader, Pill, SectionTitle, Skeleton, toneAt, toneBg } from "@/components/ui";
import { CardsSkeleton, IconBadge, ScenarioCard, StartButton, startHref } from "@/components/cards";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export default function PracticePage() {
  const { activeLanguage } = useCurrentUser();
  const [cat, setCat] = useState<string>("all");
  const all = useScenarios();
  const recent = useRecentSessions();
  const rec = useRecommended();
  const focus = usePracticeFocus();

  // Filter chips come from the categories the backend actually returned.
  const categories = useMemo(() => Array.from(new Set((all.data ?? []).map((s) => s.category))), [all.data]);
  const visible = (all.data ?? []).filter((s) => cat === "all" || s.category === cat);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <PageHeader
          eyebrow={activeLanguage?.level ? `Practice · ${activeLanguage.level}` : "Practice"}
          title="Choose your next practice"
          subtitle="Real-life conversations, structured exercises, and exam preparation — all in one place."
        />

        <div className="mb-8 flex flex-wrap gap-2">
          {["all", ...categories].map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("rounded-full border border-line px-5 py-2.5 text-sm font-medium capitalize", cat === c ? "bg-ink text-white" : "bg-white hover:bg-black/5")}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>

        <SectionTitle title="Continue from last session" action={<Link href="/progress" className="inline-flex items-center gap-1">View all history <ArrowRight size={14} /></Link>} />
        <Async query={recent} skeleton={<CardsSkeleton n={2} h="h-32" />} isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="Nothing to continue yet" text="Start a scenario below. Unfinished sessions will show up here." />}>
          {(list) => (
            <div className="grid gap-4 md:grid-cols-2">
              {list.slice(0, 2).map((s, i) => (
                <div key={s.id} className={cn("flex gap-4 rounded-card p-5", toneBg[toneAt(i)])}>
                  <IconBadge name={s.icon} tone={toneAt(i)} size={56} />
                  <div className="flex-1">
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="text-sm text-muted">{s.subtitle}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-muted"><Clock size={14} /> {s.duration} min <Pill>{s.level}</Pill></span>
                      <StartButton href={`/ai-chat?sessionId=${s.id}`} label="Continue" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Async>

        <div className="mt-8">
          <SectionTitle title="All practice scenarios" />
          <Async query={all} skeleton={<CardsSkeleton n={4} h="h-48" cols="md:grid-cols-2 2xl:grid-cols-4" />}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No scenarios yet" text="Scenarios for your learning language will appear here." />}>
            {() => visible.length === 0 ? (
              <EmptyState title="Nothing in this category" text="Try another filter." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {visible.map((s, i) => <ScenarioCard key={s.id} s={s} tone={toneAt(i)} />)}
              </div>
            )}
          </Async>
        </div>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-lg font-semibold">Recommended for you</h2>
          <p className="mb-2 text-sm text-muted">Based on your goals and recent activity.</p>
          <Async query={rec} skeleton={<Skeleton className="h-48" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No recommendations yet" text="Practice a few times and we'll suggest what to do next." />}>
            {(list) => (
              <ul className="divide-y divide-line">
                {list.slice(0, 3).map((s, i) => (
                  <li key={s.id}>
                    <Link href={startHref(s.id)} className="flex items-center gap-4 py-4">
                      <IconBadge name={s.icon} tone={toneAt(i)} size={56} />
                      <div className="flex-1">
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-sm text-muted">{s.description}</p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted"><Clock size={13} /> {s.duration} min <Pill className="bg-black/5">{s.level}</Pill></p>
                      </div>
                      <ChevronRight size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-semibold">Today's focus</h2><span className="text-xs text-muted">Based on your weak points</span></div>
          <Async query={focus} skeleton={<Skeleton className="h-40" />}
            empty={<EmptyState title="No focus yet" text="Your weak points will show up after a few sessions." />}>
            {(f) => (
              <>
                <div className="flex items-center gap-4 rounded-2xl bg-black/[0.03] p-4">
                  <IconBadge name={f.icon} tone="rose" size={56} />
                  <div><p className="font-semibold">{f.title}</p><p className="text-sm text-muted">{f.description}</p></div>
                </div>
                <div className="mt-3 flex gap-3 rounded-2xl bg-success/10 p-4 text-sm">
                  <Icon name="sparkles" className="mt-0.5 text-success" />
                  <div><p className="font-semibold">Why this?</p><p className="text-muted">{f.reason}</p></div>
                </div>
                {f.scenarioId && <Link href={startHref(f.scenarioId)} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-white">Start practice <ArrowRight size={14} /></Link>}
              </>
            )}
          </Async>
        </Card>
      </aside>
    </div>
  );
}
