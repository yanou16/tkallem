"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Lightbulb, ShieldCheck, Users } from "lucide-react";
import { Button, Card, Dialog, PageHeader } from "@/components/ui";
import { useJoinGroup, useSavedFirstName } from "../hooks/useGroups";
import { joinError } from "../lib/labels";

const FIRST_NAME_MAX = 50; // as PATCH /me

/** No group yet: one button. The API picks the most active group of the student's level, or creates one. */
export default function JoinGroup() {
  const join = useJoinGroup();
  const savedFirstName = useSavedFirstName();
  const { user } = useUser();
  const [asking, setAsking] = useState(false);
  const [firstName, setFirstName] = useState("");
  const name = firstName.trim();

  const start = () => {
    if (savedFirstName()) return join.mutate(undefined);
    setFirstName(user?.firstName ?? ""); // a suggestion from the account, saved only when she confirms
    setAsking(true);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Find your practice group" subtitle="Write in English with students of your level, every day." />
      <Card>
        <ul className="space-y-4">
          <li className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint"><Users size={20} /></span>
            <p><span className="font-semibold">Up to 8 students of your level.</span> <span className="text-muted">You join the most active group with a free place.</span></p></li>
          <li className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-butter"><Lightbulb size={20} /></span>
            <p><span className="font-semibold">A theme every week, a question every day.</span> <span className="text-muted">Answer it in the group chat.</span></p></li>
          <li className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/[0.06]"><ShieldCheck size={20} /></span>
            <p><span className="font-semibold">Check your message before sending it.</span> <span className="text-muted">Only you see the corrections.</span></p></li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={start} disabled={join.isPending}>{join.isPending ? "Joining…" : "Join a group"}</Button>
          {join.error && !asking && <p role="alert" className="rounded-2xl bg-bad-bg px-4 py-3 text-sm">{joinError(join.error)}</p>}
        </div>
      </Card>

      <Dialog open={asking} title="Your first name" onClose={() => setAsking(false)}>
        <form onSubmit={(e) => { e.preventDefault(); join.mutate(name, { onSuccess: () => setAsking(false) }); }}>
          <label htmlFor="group-first-name" className="text-sm text-muted">The other members of your group will see it.</label>
          <input id="group-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={FIRST_NAME_MAX} autoFocus
            className="mt-2 w-full rounded-xl border border-line p-3 outline-none focus:border-ink" />
          {join.error && <p role="alert" className="mt-3 rounded-2xl bg-bad-bg px-4 py-3 text-sm">{joinError(join.error)}</p>}
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={!name || join.isPending}>{join.isPending ? "Joining…" : "Save and join"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
