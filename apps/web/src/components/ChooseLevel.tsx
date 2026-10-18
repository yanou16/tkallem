"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { useUpdateProfile } from "@/features/profile/hooks/useProfile";
import { cn } from "@/lib/utils";

const LEVELS = [
  { id: "A2", title: "A2 · Beginner", text: "I can say simple things about myself, slowly." },
  { id: "B1", title: "B1 · Intermediate", text: "I can manage everyday conversations, with mistakes." },
  { id: "B2", title: "B2 · Upper intermediate", text: "I can explain my plans and give my opinion." },
  { id: "C1", title: "C1 · Advanced", text: "I speak fluently and want to sound natural." },
] as const;

/** First visit of a signed-in student: the coach needs a level (sentence length, vocabulary) before any session. */
export default function ChooseLevel() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("B1");
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const update = useUpdateProfile();

  return (
    <Card className="mx-auto mt-8 max-w-xl">
      <h1 className="text-2xl font-semibold">Welcome to Tkallem</h1>
      <p className="mt-1 text-muted">Two quick choices so your coach speaks at the right level. You can change them later in your profile.</p>

      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Your English level</legend>
        <div className="grid gap-2">
          {LEVELS.map((l) => (
            <label key={l.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3", level === l.id ? "border-ink bg-black/[0.03]" : "border-line")}>
              <input type="radio" name="level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} className="mt-1 accent-[#16161a]" />
              <span><span className="block font-medium">{l.title}</span><span className="block text-sm text-muted">{l.text}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Explain my mistakes in</legend>
        <div className="flex gap-2">
          {([["fr", "Français"], ["en", "Simple English"]] as const).map(([id, label]) => (
            <label key={id} className={cn("flex-1 cursor-pointer rounded-full border px-4 py-2 text-center text-sm font-medium", lang === id ? "border-ink bg-ink text-white" : "border-line")}>
              <input type="radio" name="explain" value={id} checked={lang === id} onChange={() => setLang(id)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {update.error && <p role="alert" className="mt-4 text-sm text-bad">Could not save: {(update.error as Error).message}. Try again.</p>}
      <Button className="mt-6 w-full" disabled={update.isPending} onClick={() => update.mutate({ level, explainLang: lang })}>
        {update.isPending ? "Saving…" : "Start practicing"}
      </Button>
    </Card>
  );
}
