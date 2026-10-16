"use client";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, Check, Crown, Heart, Lightbulb, MessageCircle, Mic, Plus, Share2, MoreHorizontal, Users, Globe, Tag, Signal } from "lucide-react";
import { useCreatePost, useGroup, useGroupPosts, useLikePost, useSetReminder, useToggleMembership } from "@/features/groups/hooks/useGroups";
import { Async, Avatar, AvatarStack, Button, Card, Dialog, EmptyState, ErrorState, Pill, Skeleton } from "@/components/ui";
import { FEATURES } from "@/lib/features";
import { cn, timeAgo } from "@/lib/utils";

type Tab = "discussion" | "voice" | "members";

function GroupPageContent() {
  const { id } = useParams<{ id: string }>();
  const group = useGroup(id);
  const posts = useGroupPosts(id);
  const membership = useToggleMembership();
  const like = useLikePost(id);
  const create = useCreatePost(id);
  const reminder = useSetReminder(id);
  const [tab, setTab] = useState<Tab>("discussion");
  const [composer, setComposer] = useState(false);
  const [draft, setDraft] = useState("");

  if (group.isLoading) return <Skeleton className="mt-6 h-[500px]" />;
  if (group.error || !group.data) return <ErrorState error={group.error} onRetry={() => group.refetch()} className="mt-6" />;
  const g = group.data;
  const next = g.nextSession;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <Link href="/groups" className="mb-4 inline-flex items-center gap-2 text-sm font-medium"><ArrowLeft size={18} /> Back to groups</Link>
        <div className="flex flex-wrap items-start gap-6">
          {g.imageUrl ? <Image src={g.imageUrl} alt="" width={136} height={136} unoptimized className="h-[136px] w-[136px] rounded-3xl object-cover" /> : <span className="flex h-[136px] w-[136px] items-center justify-center rounded-3xl bg-mint text-4xl font-bold">{g.name[0]}</span>}
          <div className="min-w-[260px] flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight">{g.name}</h1>
                <p className="mt-1 flex items-center gap-2 text-muted"><Users size={16} /> {g.memberCount} members</p>
                <div className="mt-3 flex flex-wrap gap-2">{[g.language.name, `${g.levelRange} Level`, ...g.tags].map((t) => <Pill key={t} className="border border-line">{t}</Pill>)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="Share" onClick={() => navigator.share?.({ url: location.href, title: g.name }).catch(() => {})} className="rounded-full border border-line p-3"><Share2 size={18} /></button>
                <button aria-label="More" className="rounded-full border border-line p-3"><MoreHorizontal size={18} /></button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button dark={false} onClick={() => setComposer(true)} disabled={!g.isMember}><Plus size={16} /> New post</Button>
              {g.liveVoiceRoom && <Button disabled={!g.isMember}><Mic size={16} /> Join voice room</Button>}
              <Button dark={!g.isMember} onClick={() => membership.mutate({ id, join: !g.isMember })} disabled={membership.isPending}>{g.isMember ? "Leave group" : "Join group"}</Button>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-muted">{g.description}</p>

        <div className="mt-6 flex gap-8 border-b border-line">
          {(["discussion", "voice", "members"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("-mb-px border-b-2 pb-3 font-medium capitalize", tab === t ? "border-ink" : "border-transparent text-muted")}>{t === "voice" ? "Voice Rooms" : t}</button>
          ))}
        </div>

        {tab === "discussion" && (
          <>
            {g.todayTopic && (
              <div className="mt-6 flex items-center gap-5 rounded-card bg-butter p-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-butter-deep"><Lightbulb /></span>
                <div className="flex-1"><p className="text-sm">Today&apos;s topic</p><h2 className="text-xl font-bold">{g.todayTopic.title}</h2>{g.todayTopic.description && <p className="text-muted">{g.todayTopic.description}</p>}</div>
                <Button onClick={() => setComposer(true)} disabled={!g.isMember}>Join the discussion <ArrowRight size={14} /></Button>
              </div>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-[1.6fr_1fr]">
              {g.liveVoiceRoom && (
                <div className="rounded-card bg-mint p-6">
                  <p className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Live voice room</p>
                  <h3 className="text-xl font-bold">{g.liveVoiceRoom.title}</h3>
                  <p className="text-muted">{g.liveVoiceRoom.participantCount} people talking{g.liveVoiceRoom.isOpen ? " • Open to all members" : ""}</p>
                  <div className="mt-4"><AvatarStack people={g.liveVoiceRoom.participants} size={44} max={6} /></div>
                </div>
              )}
              {next && (
                <div className="rounded-card bg-rose p-6">
                  <p className="text-sm text-muted">Next group session</p>
                  <h3 className="text-lg font-bold">{next.title}</h3>
                  <p className="text-sm text-muted">{next.startsAtLabel ?? new Date(next.startsAt).toLocaleString()} • {next.durationMinutes} min</p>
                  <button className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium"><Calendar size={14} /> Add to calendar</button>
                </div>
              )}
            </div>
            <h2 className="mb-3 mt-8 text-lg font-semibold">Recent posts</h2>
            <Async query={posts} skeleton={<Skeleton className="h-40" />} isEmpty={(d) => d.length === 0}
              empty={<EmptyState title="No posts yet" text={g.isMember ? "Start the conversation with the first post." : "Join this group to post and reply."} />}>
              {(list) => (
                <ul className="space-y-3">
                  {list.map((p) => (
                    <li key={p.id} className="flex gap-4 rounded-card border border-line bg-white p-5">
                      <div className="w-24 shrink-0"><Avatar src={p.author.avatarUrl} first={p.author.name} size={56} /><p className="mt-1 font-semibold">{p.author.name}</p><p className="text-xs text-muted">{timeAgo(p.createdAt)}</p></div>
                      <div className="flex-1"><p className="whitespace-pre-wrap">{p.body}</p>
                        <div className="mt-3 flex gap-6 text-sm text-muted">
                          <button onClick={() => like.mutate(p.id)} className={cn("flex items-center gap-1.5", p.likedByMe && "text-red-500")}><Heart size={16} fill={p.likedByMe ? "currentColor" : "none"} /> {p.likeCount}</button>
                          <span className="flex items-center gap-1.5"><MessageCircle size={16} /> {p.commentCount}</span>
                        </div></div>
                    </li>
                  ))}
                </ul>
              )}
            </Async>
          </>
        )}
        {tab === "voice" && <div className="mt-6">{g.liveVoiceRoom ? <p className="text-muted">{g.liveVoiceRoom.title} is live with {g.liveVoiceRoom.participantCount} people.</p> : <EmptyState title="No live voice rooms" text="Scheduled sessions will appear here." />}</div>}
        {tab === "members" && <div className="mt-6 grid gap-3 md:grid-cols-2">{g.moderators.length ? g.moderators.map((m) => <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3"><Avatar src={m.avatarUrl} first={m.name} /><div><p className="font-semibold">{m.name}</p><p className="text-sm text-muted">{m.role ?? "Group moderator"}</p></div></div>) : <EmptyState title="No members to show" text="Member lists appear here when available." />}</div>}
      </div>

      <aside className="space-y-4">
        <Card>
          <h2 className="mb-2 text-lg font-bold">About this group</h2>
          <p className="mb-4 text-sm text-muted">{g.description}</p>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex gap-3"><Users size={18} /> {g.memberCount} members</li>
            <li className="flex gap-3"><Signal size={18} /> {g.levelLabel ?? g.levelRange}</li>
            <li className="flex gap-3"><Globe size={18} /> {g.language.name}</li>
            {g.topics.length > 0 && <li className="flex gap-3"><Tag size={18} /> {g.topics.join(", ")}</li>}
            <li className="flex gap-3"><Calendar size={18} /> Created {new Date(g.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })}</li>
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Moderators</h2>
          {g.moderators.length === 0 ? <p className="text-sm text-muted">No moderators listed.</p> : (
            <ul className="space-y-3">{g.moderators.map((m) => (
              <li key={m.id} className="flex items-center gap-3"><Avatar src={m.avatarUrl} first={m.name} size={48} /><div><p className="flex items-center gap-1.5 font-semibold">{m.name} <Crown size={14} className="text-amber-500" /></p><p className="text-sm text-muted">{m.role ?? "Group moderator"}</p></div></li>
            ))}</ul>
          )}
        </Card>
        {next && (
          <Card>
            <h2 className="mb-3 text-lg font-bold">Upcoming session</h2>
            <p className="font-semibold">{next.title}</p>
            <p className="mb-3 text-sm text-muted">{next.startsAtLabel ?? new Date(next.startsAt).toLocaleString()} • {next.durationMinutes} min</p>
            <button disabled={next.hasReminder || reminder.isPending} onClick={() => reminder.mutate(next.id)} className="flex w-full items-center justify-center gap-2 rounded-full bg-mint py-2.5 text-sm font-semibold text-emerald-800">
              {next.hasReminder ? <>Reminder set <Check size={14} /></> : "Set reminder"}
            </button>
          </Card>
        )}
      </aside>

      <Dialog open={composer} title="New post" onClose={() => setComposer(false)}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} placeholder="Share an idea or ask a question…" className="w-full rounded-xl border border-line p-3 outline-none focus:border-ink" />
        {create.error && <p role="alert" className="mt-2 text-sm text-red-600">{create.error.message}</p>}
        <div className="mt-4 flex justify-end"><Button disabled={!draft.trim() || create.isPending} onClick={() => create.mutate(draft.trim(), { onSuccess: () => { setDraft(""); setComposer(false); } })}>Post</Button></div>
      </Dialog>
    </div>
  );
}

export default function GroupPage() {
  if (!FEATURES.groups) redirect("/practice"); // no API yet: the screen is not reachable (docs/JURY_BRIEF.md F-4)
  return <GroupPageContent />;
}
