"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, ChevronDown, ChevronRight, Pencil, Plus, Settings, Shield, UserRound, Mail, Bell, Users, Trophy, Megaphone } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useAchievements, useActivity, useAddLanguage, usePreferences, useUpdateNotifications, useUpdateProfile, useUploadAvatar } from "@/features/profile/hooks/useProfile";
import type { UpdateProfileInput } from "@/features/profile/types/profile";
import { Async, Avatar, Button, Card, Dialog, EmptyState, Pill, SectionTitle, Skeleton, Toggle, toneAt, toneBg, toneDeep } from "@/components/ui";
import { Icon } from "@/lib/icons";
import { cn, timeAgo } from "@/lib/utils";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "tr", name: "Turkish" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

type Edit =
  | { kind: "name" }
  | { kind: "bio" }
  | { kind: "goal" }
  | { kind: "mode" }
  | { kind: "daily" }
  | { kind: "focus" }
  | { kind: "language" }
  | { kind: "level" }
  | { kind: "explainLang" }
  | { kind: "avatar" }
  | null;

export default function ProfilePage() {
  const { user, activeLanguage } = useCurrentUser();
  const update = useUpdateProfile();
  const upload = useUploadAvatar();
  const addLang = useAddLanguage();
  const achievements = useAchievements();
  const activity = useActivity();
  const prefs = usePreferences();
  const notif = useUpdateNotifications();
  const [edit, setEdit] = useState<Edit>(null);
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [focusItems, setFocusItems] = useState<string[]>([]);
  const [focusInput, setFocusInput] = useState("");
  const file = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const open = (e: NonNullable<Edit>, v = "", v2 = "") => {
    setValue(v);
    setValue2(v2);
    if (e.kind === "focus") {
      setFocusItems(user.focusAreas ?? []);
      setFocusInput("");
    }
    setEdit(e);
  };
  const close = () => setEdit(null);
  const patch = (input: UpdateProfileInput) => update.mutate(input, { onSuccess: close });
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  function save() {
    switch (edit?.kind) {
      case "name":
        return patch({ firstName: value.trim(), lastName: value2.trim() });
      case "bio":
        return patch({ bio: value.trim() });
      case "goal":
        return patch({ learningGoal: value.trim() });
      case "mode":
        return patch({ preferredPracticeMode: value.trim() || "text" });
      case "daily":
        return patch({ dailyGoalMinutes: Math.max(1, Number(value) || 0) });
      case "focus":
        return patch({ focusAreas: focusItems });
      case "language": {
        const langCode = value || "en";
        const langObj = LANGUAGES.find((l) => l.code === langCode);
        const newLang = {
          id: langCode,
          code: langCode,
          name: langObj ? langObj.name : langCode,
          level: value2 || "B1",
        };
        const existing = (user.learningLanguages ?? []).filter((l) => l.code !== langCode);
        addLang.mutate({ code: langCode, level: value2 || "B1" });
        return patch({ learningLanguages: [...existing, newLang] });
      }
      case "level":
        return patch({ level: (value || "B1") as NonNullable<UpdateProfileInput["level"]> });
      case "explainLang":
        return patch({ explainLang: (value || "fr") as NonNullable<UpdateProfileInput["explainLang"]> });
      case "avatar":
        return patch({ avatarUrl: value.trim() });
    }
  }

  const pending = update.isPending || addLang.isPending;
  const error = update.error ?? addLang.error;

  const Pen = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button onClick={onClick} aria-label={`Edit ${label}`} className="rounded-full p-1.5 text-muted hover:bg-black/5"><Pencil size={15} /></button>
  );

  const addFocusItem = () => {
    const trimmed = focusInput.trim();
    if (trimmed && !focusItems.includes(trimmed)) {
      setFocusItems([...focusItems, trimmed]);
      setFocusInput("");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setValue(reader.result);
      }
    };
    reader.readAsDataURL(f);
    upload.mutate(f);
  };

  const dialogTitle = {
    name: "Edit personal information",
    bio: "Edit bio",
    goal: "Edit learning goals",
    mode: "Select practice mode",
    daily: "Edit daily practice goal",
    focus: "Edit focus areas",
    language: "Add language studied",
    level: "Select English level",
    explainLang: "Select explanation language",
    avatar: "Update profile photo",
  }[edit?.kind ?? "name"] ?? "Edit profile";

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <p className="text-sm text-muted">Profile</p>
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight">{user.firstName}</h1>

        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <Avatar src={user.avatarUrl} first={user.firstName} last={user.lastName} size={132} />
            <button onClick={() => open({ kind: "avatar" }, user.avatarUrl ?? "")} aria-label="Change photo" className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white hover:opacity-90">
              <Camera size={18} />
            </button>
            <input ref={file} type="file" accept="image/*" hidden onChange={onFileChange} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-bold">{fullName}</h2>
              <Pen label="name" onClick={() => open({ kind: "name" }, user.firstName, user.lastName ?? "")} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {user.learningLanguages.length > 0 && (
                <label className="flex items-center gap-2 rounded-full bg-black/[0.05] px-4 py-2 text-sm font-medium">
                  {activeLanguage?.flagUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={activeLanguage.flagUrl} alt="" className="h-4 w-5 rounded-sm" />}
                  <select aria-label="Active language" value={activeLanguage?.id} onChange={(e) => update.mutate({ activeLanguageId: e.target.value })} className="bg-transparent outline-none cursor-pointer">
                    {user.learningLanguages.map((l) => <option key={l.id} value={l.id}>Learning {l.name}</option>)}
                  </select>
                  <ChevronDown size={14} />
                </label>
              )}
              {activeLanguage?.level && <Pill className="bg-black/[0.05] px-4 py-2 text-sm">{activeLanguage.level}</Pill>}
            </div>
            <p className="mt-3 flex items-center gap-2 text-muted">
              {user.bio || <span className="italic">Add a short bio</span>}
              <Pen label="bio" onClick={() => open({ kind: "bio" }, user.bio ?? "")} />
            </p>
          </div>
        </div>

        <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="text-lg font-semibold">My learning setup</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          <SetupCard tone={3} icon="chart" title="English level" onEdit={() => open({ kind: "level" }, user.level ?? "B1")} text={user.level} empty="Choose your level" />
          <SetupCard tone={4} icon="book" title="Explanation language" onEdit={() => open({ kind: "explainLang" }, user.explainLang ?? "fr")} text={user.explainLang === "en" ? "English" : user.explainLang === "fr" ? "French" : undefined} empty="Choose a language" />
          <SetupCard tone={0} icon="target" title="Learning goals" onEdit={() => open({ kind: "goal" }, user.learningGoal ?? "")} text={user.learningGoal} empty="Set a learning goal" />
          <SetupCard tone={1} icon="laptop" title="Preferred practice mode" onEdit={() => open({ kind: "mode" }, user.preferredPracticeMode ?? "text")} text={user.preferredPracticeMode === "voice" ? "Voice & Audio" : user.preferredPracticeMode === "both" ? "Both (Text & Voice)" : "Text only"} empty="Choose how you like to practice" />
          <SetupCard tone={2} icon="chart" title="Daily goal" onEdit={() => open({ kind: "daily" }, String(user.dailyGoalMinutes ?? 15))} text={user.dailyGoalMinutes ? `${user.dailyGoalMinutes} minutes of speaking practice` : undefined} empty="Set a daily goal" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className={cn("rounded-card p-5", toneBg.rose)}>
            <div className="flex gap-4">
              <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", toneDeep.rose)}><Icon name="book" /></span>
              <div className="flex-1">
                <p className="font-semibold">Languages studied</p>
                {user.learningLanguages.length === 0 ? (
                  <p className="text-sm text-muted">No languages yet</p>
                ) : (
                  user.learningLanguages.map((l) => <p key={l.id} className="text-muted">{l.name} ({l.level})</p>)
                )}
                <button onClick={() => open({ kind: "language" }, "en", "B1")} className="mt-2 flex items-center gap-2 text-sm font-medium text-ink hover:underline">
                  <Plus size={14} /> Add another language
                </button>
              </div>
            </div>
          </div>
          <div className={cn("rounded-card p-5", toneBg.lilac)}>
            <div className="flex gap-4">
              <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", toneDeep.lilac)}><Icon name="star" /></span>
              <div className="flex-1">
                <p className="font-semibold">Focus areas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(user.focusAreas ?? []).length ? (
                    user.focusAreas!.map((f, i) => (
                      <Pill key={f} className="border border-line bg-white/70">
                        <span className="text-muted mr-1.5 font-mono text-xs">{i + 1}.</span>{f}
                      </Pill>
                    ))
                  ) : (
                    <p className="text-sm text-muted">Pick what you want to improve</p>
                  )}
                </div>
              </div>
              <Pen label="focus areas" onClick={() => open({ kind: "focus" })} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle title="My achievements" action={<Link href="/progress" className="inline-flex items-center gap-1">View all badges <ArrowRight size={14} /></Link>} />
          <Async query={achievements} skeleton={<Skeleton className="h-28" />} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No badges yet" text="Complete your first practice session to earn your first badge." />}>
            {(list) => (
              <div className="grid gap-3 md:grid-cols-4">
                {list.slice(0, 4).map((a, i) => (
                  <div key={a.id} className={cn("flex items-center gap-3 rounded-2xl p-4", toneBg[toneAt(i + 1)])}>
                    <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", toneDeep[toneAt(i + 1)])}><Icon name={a.icon} /></span>
                    <div className="min-w-0"><p className="font-semibold">{a.title}</p><p className="text-sm text-muted">{a.description}</p></div>
                  </div>
                ))}
              </div>
            )}
          </Async>
        </div>

        <div className="mt-8">
          <SectionTitle title="Recent activity" action={<Link href="/progress" className="inline-flex items-center gap-1">View all activity <ArrowRight size={14} /></Link>} />
          <Async query={activity} skeleton={<Skeleton className="h-32" />} isEmpty={(d) => d.length === 0} empty={<EmptyState title="No activity yet" text="Your recent sessions and groups will show up here." />}>
            {(list) => (
              <ul className="space-y-2">
                {list.slice(0, 5).map((a, i) => (
                  <li key={a.id} className={cn("flex items-center gap-3 rounded-full border border-line px-3 py-2", i === 0 && "bg-white")}>
                    <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", toneBg[toneAt(i)])}><Icon name={a.icon} size={17} /></span>
                    <div className="flex-1"><p className="font-medium">{a.title}</p><p className="text-sm text-muted">{a.detail}</p></div>
                    <span className="pr-3 text-sm text-muted">{timeAgo(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </div>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="mb-2 text-lg font-bold">Account settings</h2>
          {[
            ["Personal information", UserRound, () => open({ kind: "name" }, user.firstName, user.lastName ?? "")],
            ["Profile photo", Camera, () => open({ kind: "avatar" }, user.avatarUrl ?? "")],
            ["Email & password", Mail, null],
            ["Privacy & data", Shield, null],
            ["Language & region", Settings, () => open({ kind: "language" }, "en", "B1")],
          ].map(([t, I, fn]: any) => (
            <button key={t} onClick={fn ?? undefined} className="flex w-full items-center gap-4 border-b border-line py-4 text-left last:border-0 hover:bg-black/[0.02] px-1 rounded-lg">
              <I size={20} className="text-muted" /><span className="flex-1">{t}</span><ChevronRight size={16} />
            </button>
          ))}
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-bold">Notification preferences</h2>
          <Async query={prefs} skeleton={<Skeleton className="h-52" />}>
            {(p) => (
              <ul>{([
                ["practiceReminders", "Practice reminders", "Get reminded to practice daily", Bell],
                ["groupActivity", "Group activity", "New messages and group updates", Users],
                ["achievements", "Achievements", "Streaks, milestones and badges", Trophy],
                ["productUpdates", "Product updates", "New features and tips", Megaphone],
              ] as const).map(([k, t, s, I]) => (
                <li key={k} className="flex items-center gap-4 py-3">
                  <I size={20} className="text-muted" /><div className="flex-1"><p className="font-medium">{t}</p><p className="text-sm text-muted">{s}</p></div>
                  <Toggle label={t} checked={p.notifications[k]} disabled={notif.isPending} onChange={(v) => notif.mutate({ [k]: v })} />
                </li>
              ))}</ul>
            )}
          </Async>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-bold">AI learning preferences</h2>
          <Async query={prefs} skeleton={<Skeleton className="h-40" />}>
            {(p) => (
              <div className="divide-y divide-line rounded-xl border border-line">
                {[["Correction style", p.ai.correctionStyle], ["Voice speed", p.ai.voiceSpeed], ["Preferred topics", p.ai.preferredTopics?.join(", ")]].map(([l, v]) => (
                  <div key={l} className="px-3 py-2.5"><p className="text-sm font-medium">{l}</p><p className="text-sm text-muted">{v || "Not set"}</p></div>
                ))}
              </div>
            )}
          </Async>
        </Card>
      </aside>

      <Dialog open={!!edit} title={dialogTitle} onClose={close}>
        <div className="space-y-4">
          {edit?.kind === "name" && (
            <>
              <Input v={value} set={setValue} label="First name" />
              <Input v={value2} set={setValue2} label="Last name" />
            </>
          )}

          {edit?.kind === "bio" && <Input v={value} set={setValue} label="Bio" area />}

          {edit?.kind === "goal" && <Input v={value} set={setValue} label="Learning goal" area />}

          {edit?.kind === "mode" && (
            <div>
              <label className="block text-sm font-medium mb-1">Preferred practice mode</label>
              <select
                value={value || "text"}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink bg-white text-sm"
              >
                <option value="text">Text only</option>
                <option value="voice">Voice & Audio</option>
                <option value="both">Both (Text & Voice)</option>
              </select>
            </div>
          )}

          {edit?.kind === "daily" && (
            <Input v={value} set={setValue} label="Daily goal (minutes)" type="number" />
          )}

          {edit?.kind === "focus" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">Focus areas</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFocusItem();
                    }
                  }}
                  placeholder="e.g. Pronunciation, Job interviews, Travel..."
                  className="flex-1 rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink text-sm"
                />
                <Button type="button" onClick={addFocusItem} dark={false}>
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted">Type an item and press Enter (or click Add) to list your priorities.</p>
              <div className="max-h-56 overflow-y-auto space-y-2 pt-1">
                {focusItems.length === 0 ? (
                  <p className="text-sm italic text-muted">No focus areas added yet.</p>
                ) : (
                  focusItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-black/[0.04] px-3.5 py-2">
                      <span className="text-sm font-medium">
                        <span className="text-muted mr-2 font-mono text-xs">{idx + 1}.</span>
                        {item}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFocusItems(focusItems.filter((_, i) => i !== idx))}
                        className="text-muted hover:text-red-600 text-sm px-1.5"
                        aria-label={`Remove ${item}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {edit?.kind === "level" && (
            <div>
              <label className="block text-sm font-medium mb-1">English level</label>
              <select
                aria-label="English level"
                value={value || "B1"}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink bg-white text-sm"
              >
                <option value="A2">A2 · Elementary</option>
                <option value="B1">B1 · Intermediate</option>
                <option value="B2">B2 · Upper Intermediate</option>
                <option value="C1">C1 · Advanced</option>
              </select>
            </div>
          )}

          {edit?.kind === "explainLang" && (
            <div>
              <label className="block text-sm font-medium mb-1">Explanation language</label>
              <select
                aria-label="Explanation language"
                value={value || "fr"}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink bg-white text-sm"
              >
                <option value="fr">French (Français)</option>
                <option value="en">English</option>
              </select>
            </div>
          )}

          {edit?.kind === "language" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Language</label>
                <select
                  value={value || "en"}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink bg-white text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Your level</label>
                <select
                  value={value2 || "B1"}
                  onChange={(e) => setValue2(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink bg-white text-sm"
                >
                  {CEFR_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {edit?.kind === "avatar" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar src={value || user.avatarUrl} first={user.firstName} last={user.lastName} size={76} />
                <div className="text-sm">
                  <p className="font-semibold">Profile Photo</p>
                  <p className="text-xs text-muted">Use a Cloudinary URL or pick an image file.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cloudinary image URL</label>
                <input
                  type="url"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="https://res.cloudinary.com/.../image.jpg"
                  className="w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => file.current?.click()}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-black/5"
                >
                  Choose local file
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => setValue("")}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Clear photo URL
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-600">{error.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button dark={false} onClick={close}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function SetupCard({ tone, icon, title, text, empty, onEdit }: { tone: number; icon: string; title: string; text?: string; empty: string; onEdit: () => void }) {
  const t = toneAt(tone);
  return (
    <div className={cn("flex gap-4 rounded-card p-5", toneBg[t])}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", toneDeep[t])}><Icon name={icon} /></span>
      <div className="flex-1"><p className="font-semibold">{title}</p><p className={cn("text-sm", text ? "text-muted" : "italic text-muted")}>{text || empty}</p></div>
      <button onClick={onEdit} aria-label={`Edit ${title}`} className="h-fit rounded-full p-1.5 text-muted hover:bg-black/5"><Pencil size={15} /></button>
    </div>
  );
}

function Input({ v, set, label, area, type = "text" }: { v: string; set: (s: string) => void; label: string; area?: boolean; type?: string }) {
  const cls = "mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-ink";
  return <label className="block text-sm font-medium">{label}{area ? <textarea rows={3} value={v} onChange={(e) => set(e.target.value)} className={cls} /> : <input type={type} value={v} onChange={(e) => set(e.target.value)} className={cls} />}</label>;
}
