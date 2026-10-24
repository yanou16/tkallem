"use client";
import ProfileView from "@/features/profile/components/ProfileView";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { DAILY_GOALS, FOCUS_AREAS, LEVELS, type DailyGoalMinutes, type ExplainLang, type FocusArea, type Level, type User } from "@/features/auth/types/user";
import { useMySessions } from "@/features/practice/hooks/usePractice";
import { useAchievements, useUpdateProfile } from "@/features/profile/hooks/useProfile";
import type { UpdateProfileInput } from "@/features/profile/types/profile";
import { Button, Dialog } from "@/components/ui";
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
  return (
    <>
      <ProfileView user={user} sessions={sessions} achievements={achievements} openAccount={openAccount} open={open} />

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
    </>
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
