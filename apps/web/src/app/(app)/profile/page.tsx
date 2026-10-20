"use client";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Camera, ChevronRight, LockKeyhole, Mail, Pencil, UserRound } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { DAILY_GOALS, FOCUS_AREAS, LEVELS, type DailyGoalMinutes, type ExplainLang, type FocusArea, type Level, type User } from "@/features/auth/types/user";
import { useMySessions } from "@/features/practice/hooks/usePractice";
import { useAchievements, useUpdateProfile } from "@/features/profile/hooks/useProfile";
import type { Achievement, UpdateProfileInput } from "@/features/profile/types/profile";
import { Async, Avatar, Button, Card, Dialog, EmptyState, Pill, Skeleton, toneAt, toneDeep } from "@/components/ui";
import { SessionList } from "@/components/cards";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

const LEVEL_NAMES: Record<Level, string> = { A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate", C1: "Advanced" };
const EXPLAIN_LANGS: Record<ExplainLang, string> = { fr: "French (Français)", en: "English" };
const PRACTICE_MODES: Record<string, string> = { text: "Text only", voice: "Voice & Audio", both: "Both (Text & Voice)" };
const FOCUS_NAMES: Record<FocusArea, string> = {
  conversation: "Conversation",
  pronunciation: "Pronunciation",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  fluency: "Fluency",
  confidence: "Confidence",
};
/** The API accepts up to 200 characters for the learning goal. */
const MAX_TEXT = 200;

// Name, photo, email and password are managed by Clerk, not by our API.
const ACCOUNT_ROWS = [
  { title: "Personal information", icon: UserRound },
  { title: "Profile photo", icon: Camera },
  { title: "Email & password", icon: Mail },
];

type Edit = "level" | "explainLang" | "goal" | "mode" | "daily" | "focus";

const DIALOG_TITLES: Record<Edit, string> = {
  level: "Select English level",
  explainLang: "Select explanation language",
  goal: "Edit learning goals",
  mode: "Select practice mode",
  daily: "Edit daily practice goal",
  focus: "Edit focus areas",
};

/** The field to send to PATCH /me, or null when the value did not change. */
function changeFor(edit: Edit, value: string, focus: FocusArea[], user: User): UpdateProfileInput | null {
  switch (edit) {
    case "level":
      return value !== user.level ? { level: value as Level } : null;
    case "explainLang":
      return value !== user.explainLang ? { explainLang: value as ExplainLang } : null;
    case "daily": {
      const minutes = Number(value) as DailyGoalMinutes;
      return minutes !== user.dailyGoalMinutes ? { dailyGoalMinutes: minutes } : null;
    }
    case "goal": {
      const goal = value.trim() || null;
      return goal !== user.learningGoal ? { learningGoal: goal } : null;
    }
    case "mode":
      return value !== user.practiceMode ? { practiceMode: value } : null;
    case "focus":
      return focus.join() !== user.focusAreas.join() ? { focusAreas: focus } : null;
  }
}

export default function ProfilePage() {
  const { user } = useCurrentUser();
  const clerk = useClerk();
  const update = useUpdateProfile();
  const sessions = useMySessions(5);
  const achievements = useAchievements();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [value, setValue] = useState("");
  const [focus, setFocus] = useState<FocusArea[]>([]);
  if (!user) return null;

  const openAccount = () => clerk.openUserProfile();
  const open = (kind: Edit, initial = "") => {
    update.reset();
    setValue(initial);
    setFocus(user.focusAreas);
    setEdit(kind);
  };
  const close = () => setEdit(null);
  const save = () => {
    if (!edit) return;
    const change = changeFor(edit, value, focus, user);
    if (!change) return close();
    update.mutate(change, { onSuccess: close });
  };
  const toggleFocus = (area: FocusArea) =>
    setFocus((list) => (list.includes(area) ? list.filter((a) => a !== area) : [...list, area]));
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  const Pen = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button onClick={onClick} aria-label={`Edit ${label}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"><Pencil size={15} /></button>
  );

  return (
    <div className="w-full pb-10 pt-3 lg:pt-5">
      <header className="mb-9 sm:mb-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">Your profile</p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-5xl">Your learning, your way.</h1>
        <p className="mt-3 text-base text-muted sm:text-lg">A little about you, and how you like to learn.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
        <Card className="flex flex-col justify-center p-7 sm:p-8 lg:p-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8">
            <div className="relative shrink-0">
              <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={132} className="ring-4 ring-mint/60" />
              <button onClick={openAccount} aria-label="Change photo" className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white ring-4 ring-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
                <Camera size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm text-muted">Salam {user.firstName}</p>
              <div className="flex items-center gap-3">
                <h2 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">{fullName}</h2>
                <Pen label="name" onClick={openAccount} />
              </div>
              {user.email && <p className="mt-2 break-words text-sm text-muted sm:text-base">{user.email}</p>}
              {user.level && <div className="mt-5"><Pill className="bg-mint/70 px-4 py-2 text-sm">Learning English · {user.level}</Pill></div>}
            </div>
          </div>
        </Card>

        <aside aria-label="Account settings">
          <Card className="h-full p-7 sm:p-8">
            <h2 className="mb-4 text-lg font-semibold">Account settings</h2>
            <div className="divide-y divide-line">
              {ACCOUNT_ROWS.map(({ title, icon: I }) => (
                <button key={title} onClick={openAccount} className="group flex min-h-16 w-full items-center gap-3 rounded-xl py-4 text-left transition-colors hover:bg-black/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                  <I size={19} className="shrink-0 text-muted" aria-hidden="true" /><span className="flex-1 text-sm font-medium">{title}</span><ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted transition-transform motion-safe:group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      <section aria-labelledby="learning-setup-title" className="mt-10 lg:mt-12">
        <div className="mb-5 lg:mb-6">
          <h2 id="learning-setup-title" className="text-xl font-semibold sm:text-2xl">My learning setup</h2>
          <p className="mt-2 text-sm text-muted sm:text-base">Your preferences, ready for your next practice.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          <SetupCard tone={3} icon="chart" title="English level" onEdit={() => open("level", user.level ?? "B1")}
            text={user.level ? `${user.level} · ${LEVEL_NAMES[user.level]}` : undefined} empty="Choose your level before your first session" />
          <SetupCard tone={4} icon="book" title="Explanation language" onEdit={() => open("explainLang", user.explainLang)}
            text={EXPLAIN_LANGS[user.explainLang]} empty="Choose a language" />
          <SetupCard tone={0} icon="target" title="Learning goals" onEdit={() => open("goal", user.learningGoal ?? "")}
            text={user.learningGoal ?? undefined} empty="Set a learning goal" />
          <SetupCard tone={1} icon="laptop" title="Preferred practice mode" onEdit={() => open("mode", user.practiceMode ?? "text")}
            text={user.practiceMode ? PRACTICE_MODES[user.practiceMode] ?? user.practiceMode : undefined} empty="Choose how you like to practice" />
          <SetupCard tone={2} icon="target" title="Daily goal" onEdit={() => open("daily", String(user.dailyGoalMinutes))}
            text={`${user.dailyGoalMinutes} minutes of speaking practice`} empty="Set a daily goal" />
          <SetupCard tone={4} icon="star" title="Focus areas" onEdit={() => open("focus")}
            text={user.focusAreas.map((f) => FOCUS_NAMES[f]).join(", ") || undefined} empty="Pick what you want to improve" />
        </div>
      </section>

      <section aria-labelledby="achievements-title" className="mt-10 lg:mt-12">
        <div className="mb-5 lg:mb-6">
          <h2 id="achievements-title" className="text-xl font-semibold sm:text-2xl">My achievements</h2>
          <p className="mt-2 text-sm text-muted sm:text-base">Every milestone starts with a little practice.</p>
        </div>
        <Async query={achievements} skeleton={<Skeleton className="h-40" />} isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="No badges yet" text="Badges will show up here." />}>
          {(list) => (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
              {list.map((a) => <Badge key={a.id} a={a} />)}
            </div>
          )}
        </Async>
      </section>

      <section aria-labelledby="recent-activity-title" className="mt-10 lg:mt-12">
        <h2 id="recent-activity-title" className="mb-5 text-xl font-semibold sm:text-2xl lg:mb-6">Recent activity</h2>
        <Card className="p-6 sm:p-8">
          <Async query={sessions} skeleton={<Skeleton className="h-32" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No activity yet" text="Your recent practice sessions will show up here." />}>
            {(list) => <SessionList sessions={list} />}
          </Async>
        </Card>
      </section>

      <Dialog open={edit !== null} title={edit ? DIALOG_TITLES[edit] : ""} onClose={close}>
        <div className="space-y-4">
          {edit === "level" && (
            <Select label="English level" value={value} onChange={setValue}
              options={LEVELS.map((l): [string, string] => [l, `${l} · ${LEVEL_NAMES[l]}`])} />
          )}
          {edit === "explainLang" && (
            <Select label="Explanation language" value={value} onChange={setValue} options={Object.entries(EXPLAIN_LANGS)} />
          )}
          {edit === "daily" && (
            <Select label="Daily goal" value={value} onChange={setValue}
              options={DAILY_GOALS.map((m): [string, string] => [String(m), `${m} minutes`])} />
          )}
          {edit === "mode" && (
            <Select label="Preferred practice mode" value={value} onChange={setValue} options={Object.entries(PRACTICE_MODES)} />
          )}
          {edit === "goal" && (
            <label className="block text-sm font-medium">
              Learning goal
              <textarea rows={3} maxLength={MAX_TEXT} value={value} onChange={(e) => setValue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink" />
              <span className="mt-1 block text-right text-xs font-normal text-muted">{value.length} / {MAX_TEXT}</span>
            </label>
          )}
          {edit === "focus" && (
            <div>
              <p className="mb-2 text-sm font-medium">Pick what you want to improve</p>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((area) => {
                  const on = focus.includes(area);
                  return (
                    <button key={area} type="button" aria-pressed={on} onClick={() => toggleFocus(area)}
                      className={cn("rounded-full border border-line px-4 py-2 text-sm font-medium", on ? "bg-ink text-white" : "bg-white hover:bg-black/5")}>
                      {FOCUS_NAMES[area]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {update.error && <p role="alert" className="text-sm text-red-600">{update.error.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button dark={false} onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** Locked badges are greyed out and say so in words (never color alone). */
function Badge({ a }: { a: Achievement }) {
  return (
    <div className={cn("flex min-h-36 items-start gap-4 rounded-card border p-6 sm:p-7", a.unlocked ? "border-transparent bg-butter/65" : "border-line bg-white")}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", a.unlocked ? "bg-butter-deep/70 text-ink" : "bg-black/[0.04] text-muted")}>
        <Icon name={a.icon} size={23} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{a.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{a.description}</p>
        <p className={cn("mt-3 inline-flex items-center gap-1.5 text-xs font-medium", a.unlocked ? "text-ink/70" : "text-muted")}>
          {a.unlocked ? "Unlocked" : <><LockKeyhole size={12} aria-hidden="true" />Locked</>}
        </p>
      </div>
    </div>
  );
}

const SETUP_BACKGROUNDS = ["bg-mint/65", "bg-butter/65", "bg-peach/65", "bg-rose/65", "bg-lilac/65"];

function SetupCard({ tone, icon, title, text, empty, onEdit }: { tone: number; icon: string; title: string; text?: string; empty: string; onEdit: () => void }) {
  const t = toneAt(tone);
  return (
    <button type="button" onClick={onEdit} aria-label={`Edit ${title}`} className={cn("group flex min-h-44 w-full flex-col rounded-card p-7 text-left transition-shadow hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink lg:p-8", SETUP_BACKGROUNDS[tone % SETUP_BACKGROUNDS.length])}>
      <span className="mb-5 flex w-full items-center justify-between gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", toneDeep[t])}><Icon name={icon} size={23} /></span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-ink/60 transition-colors group-hover:bg-white/80"><Pencil size={16} aria-hidden="true" /></span>
      </span>
      <span className="text-base font-semibold">{title}</span>
      <span className={cn("mt-2 break-words text-sm leading-relaxed text-ink/70", !text && "italic")}>{text || empty}</span>
    </button>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-ink">
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}
