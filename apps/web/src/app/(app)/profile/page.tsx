"use client";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Camera, ChevronRight, Mail, Pencil, UserRound } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { DAILY_GOALS, FOCUS_AREAS, LEVELS, type DailyGoalMinutes, type ExplainLang, type FocusArea, type Level, type User } from "@/features/auth/types/user";
import { useMySessions } from "@/features/practice/hooks/usePractice";
import { useAchievements, useUpdateProfile } from "@/features/profile/hooks/useProfile";
import type { Achievement, UpdateProfileInput } from "@/features/profile/types/profile";
import { Async, Avatar, Button, Card, Dialog, EmptyState, Pill, SectionTitle, Skeleton, toneAt, toneBg, toneDeep } from "@/components/ui";
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
    <button onClick={onClick} aria-label={`Edit ${label}`} className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-black/5"><Pencil size={16} /></button>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <p className="text-sm text-muted">Profile</p>
        <h1 className="mb-6 text-5xl font-medium tracking-tight">{user.firstName}</h1>

        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={132} />
            <button onClick={openAccount} aria-label="Change photo" className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white hover:opacity-90">
              <Camera size={18} />
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-semibold">{fullName}</h2>
              <Pen label="name" onClick={openAccount} />
            </div>
            {user.email && <p className="mt-1 text-muted">{user.email}</p>}
            {user.level && <div className="mt-3"><Pill className="bg-black/[0.05] px-4 py-2 text-sm">Learning English · {user.level}</Pill></div>}
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-lg font-semibold">My learning setup</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <SetupCard tone={3} icon="chart" title="English level" onEdit={() => open("level", user.level ?? "B1")}
            text={user.level ? `${user.level} · ${LEVEL_NAMES[user.level]}` : undefined} empty="Choose your level before your first session" />
          <SetupCard tone={4} icon="book" title="Explanation language" onEdit={() => open("explainLang", user.explainLang)}
            text={EXPLAIN_LANGS[user.explainLang]} empty="Choose a language" />
          <SetupCard tone={0} icon="target" title="Learning goals" onEdit={() => open("goal", user.learningGoal ?? "")}
            text={user.learningGoal ?? undefined} empty="Set a learning goal" />
          <SetupCard tone={1} icon="laptop" title="Preferred practice mode" onEdit={() => open("mode", user.practiceMode ?? "text")}
            text={user.practiceMode ? PRACTICE_MODES[user.practiceMode] ?? user.practiceMode : undefined} empty="Choose how you like to practice" />
          <SetupCard tone={2} icon="chart" title="Daily goal" onEdit={() => open("daily", String(user.dailyGoalMinutes))}
            text={`${user.dailyGoalMinutes} minutes of speaking practice`} empty="Set a daily goal" />
          <SetupCard tone={4} icon="star" title="Focus areas" onEdit={() => open("focus")}
            text={user.focusAreas.map((f) => FOCUS_NAMES[f]).join(", ") || undefined} empty="Pick what you want to improve" />
        </div>
        {/* Hidden for the MVP: "Languages studied" and "Add another language" (English only). */}

        <div className="mt-8">
          <SectionTitle title="My achievements" />
          <Async query={achievements} skeleton={<Skeleton className="h-28" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No badges yet" text="Badges will show up here." />}>
            {(list) => (
              <div className="grid gap-3 md:grid-cols-3">
                {list.map((a, i) => <Badge key={a.id} a={a} tone={i} />)}
              </div>
            )}
          </Async>
        </div>

        <div className="mt-8">
          <SectionTitle title="Recent activity" />
          <Card>
            <Async query={sessions} skeleton={<Skeleton className="h-32" />} isEmpty={(d) => d.length === 0}
              empty={<EmptyState title="No activity yet" text="Your recent practice sessions will show up here." />}>
              {(list) => <SessionList sessions={list} />}
            </Async>
          </Card>
        </div>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Account settings</h2>
          {ACCOUNT_ROWS.map(({ title, icon: I }) => (
            <button key={title} onClick={openAccount} className="flex w-full items-center gap-4 rounded-lg border-b border-line px-1 py-4 text-left last:border-0 hover:bg-black/[0.02]">
              <I size={20} className="text-muted" /><span className="flex-1">{title}</span><ChevronRight size={16} />
            </button>
          ))}
        </Card>
        {/* TODO: "Notification preferences" and "AI learning preferences" once the API stores them. */}
      </aside>

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
              <span className="mt-1 block text-right text-sm font-normal text-muted">{value.length} / {MAX_TEXT}</span>
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

/** Locked badges are grayed out and say so in words (never color alone). */
function Badge({ a, tone }: { a: Achievement; tone: number }) {
  const t = toneAt(tone + 1);
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl p-4", a.unlocked ? toneBg[t] : "bg-black/[0.04] opacity-60")}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", a.unlocked ? toneDeep[t] : "bg-black/[0.06]")}>
        <Icon name={a.icon} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{a.title}</p>
        <p className="text-sm text-muted">{a.description}</p>
        {!a.unlocked && <p className="mt-1 text-sm font-semibold text-muted">Locked</p>}
      </div>
    </div>
  );
}

function SetupCard({ tone, icon, title, text, empty, onEdit }: { tone: number; icon: string; title: string; text?: string; empty: string; onEdit: () => void }) {
  const t = toneAt(tone);
  return (
    <div className={cn("flex gap-4 rounded-card p-5", toneBg[t])}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", toneDeep[t])}><Icon name={icon} /></span>
      <div className="flex-1"><p className="font-semibold">{title}</p><p className={cn("text-sm", text ? "text-muted" : "italic text-muted")}>{text || empty}</p></div>
      <button onClick={onEdit} aria-label={`Edit ${title}`} className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-black/5"><Pencil size={16} /></button>
    </div>
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
