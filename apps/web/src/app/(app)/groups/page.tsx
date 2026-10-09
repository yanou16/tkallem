"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Globe, GraduationCap, Mic, Search, Signal, Tag } from "lucide-react";
import { useActiveTopics, useGroups, useSuggestedGroups, useUpcomingSessions } from "@/features/groups/hooks/useGroups";
import type { GroupFilters } from "@/features/groups/types/groups";
import { Async, Card, EmptyState, PageHeader, SectionTitle, Skeleton, toneAt, toneBg, toneDeep } from "@/components/ui";
import { CardsSkeleton, GroupCard } from "@/components/cards";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export default function GroupsPage() {
  const [filters, setFilters] = useState<GroupFilters>({});
  const [search, setSearch] = useState("");
  const set = (p: Partial<GroupFilters>) => setFilters((f) => ({ ...f, ...p }));
  const groups = useGroups({ ...filters, search: search || undefined });
  const suggested = useSuggestedGroups();
  const sessions = useUpcomingSessions();
  const topics = useActiveTopics();

  // Dropdown options come from what the backend returned.
  const opts = useMemo(() => {
    const d = groups.data ?? [];
    return {
      language: Array.from(new Set(d.map((g) => g.language.name))),
      level: Array.from(new Set(d.map((g) => g.levelRange))),
      topic: Array.from(new Set(d.flatMap((g) => g.tags))),
    };
  }, [groups.data]);
  const isAll = !filters.language && !filters.level && !filters.topic && !filters.voiceRooms && !filters.examPrep;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <PageHeader title="Find your speaking community" subtitle="Join live conversations, meet learners like you, and practice together." />
        <label className="relative mb-4 block">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted" size={20} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups (e.g. English, IELTS, travel…)"
            className="w-full rounded-full border border-line bg-white py-4 pl-14 pr-5 outline-none focus:border-ink" />
        </label>
        <div className="mb-8 flex flex-wrap gap-2.5">
          <button onClick={() => { setFilters({}); setSearch(""); }} className={cn("rounded-full px-5 py-2.5 text-sm font-semibold", isAll ? "bg-ink text-white" : "border border-line bg-white")}>All groups</button>
          <Select icon={<Globe size={16} />} label="Language" value={filters.language} options={opts.language} onChange={(v) => set({ language: v })} />
          <Select icon={<Signal size={16} />} label="Level" value={filters.level} options={opts.level} onChange={(v) => set({ level: v })} />
          <Select icon={<Tag size={16} />} label="Topic" value={filters.topic} options={opts.topic} onChange={(v) => set({ topic: v })} />
          <Chip active={!!filters.voiceRooms} onClick={() => set({ voiceRooms: !filters.voiceRooms })}><Mic size={16} /> Voice rooms</Chip>
          <Chip active={!!filters.examPrep} onClick={() => set({ examPrep: !filters.examPrep })}><GraduationCap size={16} /> Exam prep</Chip>
        </div>

        <SectionTitle title="Popular groups" />
        <Async query={groups} skeleton={<CardsSkeleton n={6} h="h-52" cols="md:grid-cols-2 2xl:grid-cols-3" />} isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="No groups found" text="Try a different search or clear your filters. Join a community to start practicing with other learners." />}>
          {(list) => <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{list.map((g, i) => <GroupCard key={g.id} g={g} tone={toneAt(i)} />)}</div>}
        </Async>

        <div className="mt-8">
          <SectionTitle title="Suggested for you" />
          <Async query={suggested} skeleton={<CardsSkeleton n={3} h="h-28" cols="md:grid-cols-3" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No suggestions yet" text="Finish a few practice sessions and we'll suggest communities." />}>
            {(list) => <div className="grid gap-4 md:grid-cols-3">{list.slice(0, 3).map((g, i) => <GroupCard key={g.id} g={g} tone={toneAt(i + 3)} small />)}</div>}
          </Async>
        </div>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="mb-2 text-xl font-bold">Upcoming group sessions</h2>
          <Async query={sessions} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No sessions scheduled" text="Join a group to see its voice sessions here." />}>
            {(list) => (
              <ul className="divide-y divide-line">
                {list.slice(0, 5).map((s, i) => (
                  <li key={s.id} className="flex items-center gap-4 py-3">
                    <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", toneBg[toneAt(i)])}><Icon name={s.icon ?? "chat"} size={24} /></span>
                    <div className="flex-1"><p className="font-semibold">{s.groupName ?? s.title}</p>
                      <p className="text-sm text-muted">{s.startsAtLabel ?? new Date(s.startsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })} • {s.durationMinutes} min</p></div>
                    <Link href={`/groups/${s.groupId}`} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:bg-black/5">Join</Link>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
        <Card>
          <h2 className="mb-2 text-xl font-bold">Most active topics</h2>
          <Async query={topics} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No topics yet" text="Active topics will appear as communities start talking." />}>
            {(list) => (
              <ol className="divide-y divide-line">
                {list.slice(0, 5).map((t, i) => (
                  <li key={t.id} className="flex items-center gap-4 py-3">
                    <span className="w-5 text-center font-medium">{i + 1}</span>
                    <div className="flex-1"><p className="font-semibold">{t.name}</p><p className="text-sm text-muted">{t.conversationCount} conversations</p></div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", toneDeep[toneAt(i)])}>{t.trend}</span>
                  </li>
                ))}
              </ol>
            )}
          </Async>
        </Card>
      </aside>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium", active ? "bg-ink text-white" : "border border-line bg-white")}>{children}</button>;
}
function Select({ icon, label, value, options, onChange }: { icon: React.ReactNode; label: string; value?: string; options: string[]; onChange: (v?: string) => void }) {
  return (
    <label className={cn("flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-medium", value && "border-ink")}>
      {icon}
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className="bg-transparent outline-none">
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
