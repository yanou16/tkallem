"use client";
import Link from "next/link";
import { Lightbulb, Lock, Users } from "lucide-react";
import { Async, Card, PageHeader, Pill, Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/config";
import { useGroupPreview } from "../hooks/useGroups";
import { plural } from "@/lib/utils";

/**
 * Groups for a visitor without an account: they can look (this week's theme, today's question, groups of their level) but
 * not join or write. The API sends no member name and no message to guests; the lock is also enforced there (403).
 */
export default function GuestGroups() {
  const preview = useGroupPreview();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Practice groups" subtitle="Write in English with students of your level, every day." />
      <Async query={preview} skeleton={<Skeleton className="h-64" />}>
        {(p) => (
          <div className="space-y-5">
            <Card>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate"><Lightbulb size={16} aria-hidden /> This week: {p.theme.title}</p>
              <p className="mt-2 text-xl font-medium leading-snug">{p.theme.question}</p>
              <p className="mt-2 text-sm text-slate">A new question every day, answered in the group chat.</p>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold">Groups at your level</h2>
              {p.groups.length === 0 ? (
                <p className="mt-2 text-slate">A group is created for you when you join.</p>
              ) : (
                <ul className="mt-3 divide-y divide-hairline">
                  {p.groups.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 py-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface"><Users size={18} aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{g.name}</span>
                        <span className="block text-sm text-slate">{g.memberCount === 0 ? "Be the first to join" : `${plural(g.memberCount, "student")} of 8`}</span>
                      </span>
                      <Pill>{g.level}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex items-center gap-3 rounded-full border border-hairline bg-surface px-4 py-3 text-slate" aria-hidden>
                <Lock size={16} /> <span className="truncate">Write to your group…</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold">Log in to unlock the group chat</h2>
              <p className="mt-1 text-slate">Joining and writing are for students with an account. Your guest answers and credits come with you.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={ROUTES.signUp} className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 font-semibold text-white hover:bg-black/80">Create a free account</Link>
                <Link href={ROUTES.signIn} className="inline-flex min-h-12 items-center justify-center rounded-full border border-hairline px-6 font-semibold">Log in</Link>
              </div>
            </Card>
          </div>
        )}
      </Async>
    </div>
  );
}
