"use client";
import { R } from "@/components/PreviewRegion";
import { Camera, ChevronRight, Mail, Pencil, UserRound } from "lucide-react";
import { type ExplainLang, type FocusArea, type Level, type User } from "@/features/auth/types/user";
import type { Achievement } from "@/features/profile/types/profile";
import { Async, Avatar, Card, EmptyState, Pill, SectionTitle, Skeleton, toneAt, toneBg } from "@/components/ui";
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
// Name, photo, email and password are managed by Clerk, not by our API.
const ACCOUNT_ROWS = [
  { title: "Personal information", icon: UserRound },
  { title: "Profile photo", icon: Camera },
  { title: "Email & password", icon: Mail },
];

type Edit = "level" | "explainLang" | "goal" | "mode" | "daily" | "focus";

type Query<T> = { data?: T; isLoading: boolean; error: unknown; refetch: () => unknown };
export default function ProfileView({ user, sessions, achievements, openAccount = () => {}, open = () => {} }: {
  user: User;
  sessions: Query<import("@/features/practice/types/practice").SessionSummary[]>;
  achievements: Query<Achievement[]>;
  openAccount?: () => void;
  open?: (kind: Edit, initial?: string) => void;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const Pen = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button onClick={onClick} aria-label={`Edit ${label}`} className="rounded-full p-1.5 text-muted hover:bg-black/5"><Pencil size={15} /></button>
  );
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <p className="text-sm text-muted">Profile</p>
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight">{user.firstName}</h1>

        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={132} />
            <button onClick={openAccount} aria-label="Change photo" className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white hover:opacity-90">
              <Camera size={18} />
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold">{fullName}</h2>
              <Pen label="name" onClick={openAccount} />
            </div>
            {user.email && <p className="mt-1 text-muted">{user.email}</p>}
            {user.level && <div className="mt-3"><Pill className="bg-black/[0.05] px-4 py-2 text-sm">Learning English · {user.level}</Pill></div>}
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-lg font-semibold">My learning setup</h2>
        <R id="setup" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <SetupCard tone={3} icon="chart" title="English level" onEdit={() => open("level", user.level ?? "B1")}
            text={user.level ? `${user.level} · ${LEVEL_NAMES[user.level]}` : undefined} empty="Choose your level before your first session" />
          <R id="lang"><SetupCard tone={4} icon="book" title="Explanation language" onEdit={() => open("explainLang", user.explainLang)}
            text={EXPLAIN_LANGS[user.explainLang]} empty="Choose a language" /></R>
          <SetupCard tone={0} icon="target" title="Learning goals" onEdit={() => open("goal", user.learningGoal ?? "")}
            text={user.learningGoal ?? undefined} empty="Set a learning goal" />
          <SetupCard tone={1} icon="laptop" title="Preferred practice mode" onEdit={() => open("mode", user.practiceMode ?? "text")}
            text={user.practiceMode ? PRACTICE_MODES[user.practiceMode] ?? user.practiceMode : undefined} empty="Choose how you like to practice" />
          <SetupCard tone={2} icon="clock" title="Daily goal" onEdit={() => open("daily", String(user.dailyGoalMinutes))}
            text={`${user.dailyGoalMinutes} minutes of speaking practice`} empty="Set a daily goal" />
          <R id="focus"><SetupCard tone={4} icon="star" title="Focus areas" onEdit={() => open("focus")}
            text={user.focusAreas.map((f) => FOCUS_NAMES[f]).join(", ") || undefined} empty="Pick what you want to improve" /></R>
        </R>
        {/* Hidden for the MVP: "Languages studied" and "Add another language" (English only). */}

        <div className="mt-8">
          <SectionTitle title="My achievements" />
          <Async query={achievements} skeleton={<Skeleton className="h-28" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No badges yet" text="Badges will show up here." />}>
            {(list) => (
              <R id="badges" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {list.map((a, i) => <Badge key={a.id} a={a} tone={i} />)}
              </R>
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
          <h2 className="mb-2 text-lg font-bold">Account settings</h2>
          {ACCOUNT_ROWS.map(({ title, icon: I }) => (
            <button key={title} onClick={openAccount} className="flex w-full items-center gap-4 rounded-lg border-b border-line px-1 py-4 text-left last:border-0 hover:bg-black/[0.02]">
              <I size={20} className="text-muted" /><span className="flex-1">{title}</span><ChevronRight size={16} />
            </button>
          ))}
        </Card>
        {/* TODO: "Notification preferences" and "AI learning preferences" once the API stores them. */}
      </aside>

    </div>
  );
}

/** Locked badges are greyed out and say so in words (never color alone). */
function Badge({ a, tone }: { a: Achievement; tone: number }) {
  const t = toneAt(tone + 1);
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl px-5 py-4", a.unlocked ? toneBg[t] : "bg-black/[0.025]")}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center", a.unlocked ? "text-[#B48835]/45" : "text-muted/40")}>
        <Icon name={a.icon} size={32} />
      </span>
      <div className="min-w-0">
        <p className={cn("font-semibold", !a.unlocked && "text-muted")}>{a.title}</p>
        <p className="mt-0.5 text-sm text-muted">{a.description}</p>
        {!a.unlocked && <p className="mt-1 text-xs font-medium text-muted">Locked</p>}
      </div>
    </div>
  );
}

const ART_COLORS = ["text-[#479C91]/40", "text-[#C09535]/40", "text-[#CB925E]/40", "text-[#C87588]/40", "text-[#9280CB]/40"];

/** Decorative, low-contrast theme drawings; all settings keep their original edit action. */
function ProfileArt({ name, className }: { name: string; className?: string }) {
  return <svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    {name === "chart" && <><path d="M15 74H103M25 73V61H43V47H61V33H80V73M81 33V12M82 13Q93 7 102 14L96 23Q88 18 82 22" /></>}
    {name === "book" && <><path d="M10 20Q18 10 37 13Q58 15 58 28Q59 42 42 46L25 44L15 53L19 40Q5 33 10 20Z" /><path d="M30 34L37 22L43 35M33 30H40M60 48Q73 41 85 48Q97 43 110 48L108 76Q96 70 84 76Q71 70 59 74Z M85 49L84 75M65 54L77 53M65 61L77 60M91 54L103 53M91 61L103 60" /></>}
    {name === "target" && <><circle cx="58" cy="49" r="28" /><circle cx="58" cy="49" r="18" /><circle cx="58" cy="49" r="7" /><path d="M59 48L96 12M85 22V12L97 8L96 21L85 22" /></>}
    {name === "laptop" && <><path d="M29 59Q18 58 18 46V31Q18 19 29 20Q39 20 39 31V46Q39 59 29 59Z M11 42V47Q11 66 28 66Q47 66 47 47V42M28 67V77M20 78H37M61 19Q74 12 90 17Q107 20 104 34Q102 47 84 47L69 45L59 52L62 41Q52 30 61 19Z" /><circle cx="69" cy="31" r="1" /><circle cx="80" cy="31" r="1" /><circle cx="91" cy="31" r="1" /></>}
    {name === "clock" && <><circle cx="61" cy="48" r="27" /><path d="M61 30V48L48 59M42 22Q29 12 24 25L34 31M79 21Q90 12 96 23L87 30M42 72L36 82M80 72L86 81M57 13H67M62 13V20" /></>}
    {name === "star" && <><circle cx="48" cy="38" r="23" /><path d="M64 56L92 77L99 68L73 49M48 23L53 33L64 34L56 42L58 53L48 48L38 53L40 42L32 34L43 33Z" /></>}
  </svg>;
}

function SetupCard({ tone, icon, title, text, empty, onEdit }: { tone: number; icon: string; title: string; text?: string; empty: string; onEdit: () => void }) {
  const t = toneAt(tone);
  return (
    <div className={cn("relative flex min-h-[104px] items-center overflow-hidden rounded-card p-5 pr-28", toneBg[t])}>
      <div className="relative z-10 min-w-0 flex-1"><p className="font-semibold">{title}</p><p className={cn("mt-1 break-words text-sm leading-relaxed text-muted", !text && "italic")}>{text || empty}</p></div>
      <ProfileArt name={icon} className={cn("pointer-events-none absolute right-9 top-1/2 h-16 w-20 -translate-y-1/2", ART_COLORS[tone % ART_COLORS.length])} />
      <button onClick={onEdit} aria-label={`Edit ${title}`} className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"><Pencil size={15} /></button>
    </div>
  );
}

