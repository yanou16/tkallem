"use client";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ChartNoAxesColumn, ChevronDown, ChevronRight, CircleAlert, Lightbulb, Send } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { useAiSession, useEndSession, useSendAnswer, useStartSession } from "@/features/ai-chat/hooks/useAiChat";
import type { ChatMessage, Correction, SentenceStatus, SessionReport } from "@/features/ai-chat/types/ai";
import { Avatar, Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { startHref } from "@/components/cards";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/lib/icons";
import { cn, formatMinutes, formatNumber, plural } from "@/lib/utils";

const MAX = 500;

/* ---------- traffic lights: the color always comes with a word (docs/DESIGN.md) ---------- */
const STATUS_STYLE: Record<SentenceStatus, string> = {
  green: "bg-[color:var(--good-bg)] text-[color:var(--good)]",
  orange: "bg-[color:var(--warn-bg)] text-[color:var(--warn)]",
  red: "bg-[color:var(--bad-bg)] text-[color:var(--bad)]",
};
const STATUS_BAR: Record<SentenceStatus, string> = {
  green: "bg-[color:var(--good)]",
  orange: "bg-[color:var(--warn)]",
  red: "bg-[color:var(--bad)]",
};
const LEVEL_LABEL: Record<SentenceStatus, string> = { green: "Good", orange: "To work on", red: "Priority" };

function answerLabel(status: SentenceStatus, fixes: number) {
  if (status === "green") return "Clean";
  if (status === "red") return "Redo";
  return fixes > 0 ? plural(fixes, "fix", "fixes") : "To work on";
}

/* ---------- what to tell the student when a call fails ---------- */
type Help = { text: string; retry?: boolean; restart?: boolean; chooseLevel?: boolean };

function startHelp(e: unknown): Help {
  if (e instanceof ApiError && e.status === 409) return { text: "Choose your English level before your first session.", chooseLevel: true };
  if (e instanceof ApiError && e.status === 404) return { text: "This scenario doesn't exist. Pick another one above." };
  return { text: e instanceof ApiError ? e.message : "Something went wrong.", retry: true };
}

function answerHelp(e: unknown): Help {
  if (!(e instanceof ApiError)) return { text: "Something went wrong.", retry: true };
  if (e.status === 502) return { text: "Your coach didn't answer. Nothing was saved: send the same answer again.", retry: true };
  if (e.status === 409) return { text: "This session was ended or changed in the meantime.", restart: true };
  if (e.status === 404) return { text: "This session doesn't exist anymore.", restart: true };
  if (e.status === 422) return { text: e.message };
  return { text: e.message, retry: true };
}

function endHelp(e: unknown): Help {
  if (!(e instanceof ApiError)) return { text: "Something went wrong.", retry: true };
  if (e.status === 502) return { text: "The report could not be generated. Nothing was saved, try again.", retry: true };
  if (e.status === 409 || e.status === 404) return { text: e.message, restart: true };
  return { text: e.message, retry: true };
}

function loadHelp(e: unknown): Help {
  if (e instanceof ApiError && e.status === 404) return { text: "This session doesn't exist anymore.", restart: true };
  return { text: e instanceof ApiError ? e.message : "Something went wrong.", retry: true };
}

export default function AiChatPage() {
  return <Suspense fallback={<Skeleton className="mt-6 h-96" />}><Chat /></Suspense>;
}

function Chat() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? undefined;
  const urlScenarioId = params.get("scenarioId") ?? undefined;
  const { user } = useCurrentUser();
  const scenarios = useScenarios();
  const start = useStartSession();
  const session = useAiSession(sessionId);
  const send = useSendAnswer(sessionId);
  const end = useEndSession(sessionId);
  const s = session.data;
  const scenarioId = s?.scenarioId ?? urlScenarioId;

  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const started = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const begin = (id: string) => {
    started.current = id;
    start.mutate(id, {
      onSuccess: (s) => router.replace(`/ai-chat?sessionId=${encodeURIComponent(s.sessionId)}&scenarioId=${encodeURIComponent(id)}`),
    });
  };

  // Start a backend session when arriving with ?scenarioId=… only (with ?sessionId=…, the session is loaded instead).
  useEffect(() => {
    if (sessionId || !urlScenarioId || started.current === urlScenarioId) return;
    begin(urlScenarioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlScenarioId, sessionId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [s?.messages.length]);

  /** A new session for this scenario, or for another one. */
  const restart = (id = scenarioId) => {
    setText("");
    send.reset();
    end.reset();
    if (!id) return router.push("/practice");
    if (!sessionId && id === urlScenarioId) return begin(id);
    started.current = null;
    router.replace(startHref(id));
  };

  const submit = () => {
    const answer = text.trim();
    if (!answer || !sessionId || !s || s.finished || send.isPending) return;
    // The text stays in the input until the API saved it, so a failed answer can be sent again.
    send.mutate(answer, { onSuccess: () => setText("") });
  };
  const finish = () => {
    if (sessionId && !end.isPending) end.mutate();
  };

  const scenario = scenarios.data?.find((x) => x.id === scenarioId);
  const title = s?.title ?? scenario?.title ?? scenarioId;
  const icon = scenario?.icon ?? scenarioId;
  if (s?.report) return <Report report={s.report} title={title} onRestart={() => restart()} />;

  const answers = s?.messages.filter((m) => m.role === "user") ?? [];
  const last = answers[answers.length - 1];
  const problem = send.error ? answerHelp(send.error) : end.error ? endHelp(end.error) : null;

  let body: ReactNode;
  if (!sessionId && !scenarioId) {
    body = <EmptyState title="Start your first conversation" text="Pick a scenario above and your tutor will ask the first question." />;
  } else if (start.error) {
    body = <Problem help={startHelp(start.error)} onRetry={() => scenarioId && begin(scenarioId)} />;
  } else if (session.error) {
    body = <Problem help={loadHelp(session.error)} onRetry={() => session.refetch()} onRestart={() => restart()} />;
  } else if (!s) {
    body = <div className="space-y-4"><Skeleton className="h-20 w-2/3" /><Skeleton className="ml-auto h-20 w-2/3" /></div>;
  } else {
    body = s.messages.map((m) => <Bubble key={m.id} m={m} icon={icon} user={user} />);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-h-[calc(100vh-110px)] flex-col">
        <PageHeader title="AI Chat" subtitle="Have a realistic conversation with your AI tutor. Get instant feedback and improve naturally." />

        <div className="mb-4 grid gap-3 md:grid-cols-[1.3fr_0.8fr]">
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex w-full items-center gap-3 rounded-2xl bg-peach p-3 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-peach-deep"><Icon name={icon ?? "briefcase"} /></span>
              <span className="flex-1"><span className="block text-xs text-muted">Scenario</span><span className="font-semibold">{title ?? "Choose a scenario"}</span></span>
              <ChevronDown size={18} />
            </button>
            {menu && (
              <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-soft">
                {(scenarios.data ?? []).map((sc) => (
                  <li key={sc.id}><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                    onClick={() => { setMenu(false); restart(sc.id); }}>{sc.title}</button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-mint p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-deep"><ChartNoAxesColumn size={20} /></span>
            <span><span className="block text-xs text-muted">Level</span><span className="font-semibold">{user?.level ?? "—"}</span></span>
          </div>
          {/* TODO: Text / Voice switch and mic, once POST /sessions/{id}/turn accepts audio. */}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
          {s && (
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3 text-sm">
              <span className="text-muted">{plural(answers.length, "answer")}</span>
              {answers.length > 0 && !s.finished && (
                <Button dark={false} onClick={finish} disabled={end.isPending} className="!px-4 !py-2">
                  {end.isPending ? "Preparing your report…" : "End session"}
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto p-6" aria-live="polite">
            {body}
            {send.isPending && <p className="text-sm text-muted">Your tutor is replying…</p>}
            <div ref={bottom} />
          </div>

          {problem && (
            <div className="px-6 pb-2">
              <Problem help={problem} onRetry={send.error ? submit : finish} onRestart={() => restart()} />
            </div>
          )}

          {s?.finished ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
              <p className="text-muted">You answered every question.</p>
              <Button onClick={finish} disabled={end.isPending}>{end.isPending ? "Preparing your report…" : "See my report"}</Button>
            </div>
          ) : (
            <div className="flex items-center gap-4 border-t border-line p-4">
              <div className="flex-1">
                <input value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={!s || send.isPending} placeholder="Type your response here…"
                  className="w-full rounded-full border border-line px-5 py-3.5 outline-none focus:border-ink disabled:bg-black/[0.03]" />
                <p className="mt-1 text-right text-xs text-muted">{text.length} / {MAX}</p>
              </div>
              <button onClick={submit} disabled={!text.trim() || !s || send.isPending} aria-label="Send"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><Send size={20} /></button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Live corrections</h2>
            {s && !s.finished && <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Active</span>}</div>
          {!last ? (
            <EmptyState title="No corrections yet" text="Send an answer and your tutor will suggest improvements here." />
          ) : last.corrections?.length ? (
            last.corrections.map((c, i) => <CorrectionCard key={i} c={c} />)
          ) : (
            <EmptyState title="Clean answer" text="No correction on your last answer." />
          )}
          {last && <SummaryRow icon={<CircleAlert size={18} />} tone="bg-rose" title="Corrections this turn" sub={plural(last.corrections?.length ?? 0, "suggestion")} />}
        </Card>
      </aside>
    </div>
  );
}

function Problem({ help, onRetry, onRestart }: { help: Help; onRetry?: () => void; onRestart?: () => void }) {
  const small = "!px-3 !py-1.5 text-xs";
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-deep bg-rose/50 p-4 text-sm">
      <CircleAlert className="shrink-0" size={18} />
      <p className="flex-1">{help.text}</p>
      {help.chooseLevel && <Link href="/profile" className="font-semibold underline">Choose my level</Link>}
      {help.retry && onRetry && <Button dark={false} onClick={onRetry} className={small}>Try again</Button>}
      {help.restart && onRestart && <Button dark={false} onClick={onRestart} className={small}>Start a new session</Button>}
    </div>
  );
}

function StatusPill({ status, label }: { status: SentenceStatus; label: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[status])}>{label}</span>;
}

function Bubble({ m, icon, user }: { m: ChatMessage; icon?: string; user?: ReturnType<typeof useCurrentUser>["user"] }) {
  const mine = m.role === "user";
  const time = m.createdAt && new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("flex items-start gap-3", mine && "justify-end")}>
      {!mine && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"><Icon name={icon ?? "briefcase"} /></span>}
      <div className={cn("max-w-[75%]", mine && "text-right")}>
        <p className={cn("whitespace-pre-wrap rounded-3xl px-5 py-4 text-left", mine ? "bg-mint" : "bg-black/[0.05]")}>{m.content}</p>
        <div className={cn("mt-1 flex items-center gap-2", mine && "justify-end")}>
          {m.status && <StatusPill status={m.status} label={answerLabel(m.status, m.corrections?.length ?? 0)} />}
          {time && <span className="text-xs text-muted">{time}</span>}
        </div>
      </div>
      {mine && <Avatar src={user?.avatarUrl} first={user?.firstName} last={user?.lastName} size={44} />}
    </div>
  );
}

function CorrectionCard({ c }: { c: Correction }) {
  const grammar = c.type === "grammar";
  return (
    <div className={cn("rounded-2xl p-4", grammar ? "bg-rose" : "bg-butter")}>
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", grammar ? "bg-rose-deep" : "bg-butter-deep")}>
          {grammar ? <CircleAlert size={18} /> : <Lightbulb size={18} />}
        </span>
        {grammar ? "Grammar correction" : "Better phrasing"}
      </p>
      <p className="text-xs font-medium">Your sentence</p>
      <p className="mb-1 rounded-lg bg-rose-deep/60 px-3 py-1.5 text-sm">{c.original}</p>
      <ArrowDown size={14} className="mx-auto my-1" />
      <p className="text-xs font-medium">{grammar ? "Better version" : "More natural"}</p>
      <p className="mb-2 rounded-lg bg-mint-deep/70 px-3 py-1.5 text-sm">{c.fixed}</p>
      <p className="rounded-lg bg-white/60 px-3 py-2 text-xs text-muted">{c.why}</p>
    </div>
  );
}

function SummaryRow({ icon, tone, title, sub }: { icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>{icon}</span>
      <div className="flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-muted">{sub}</p></div>
      <ChevronRight size={16} />
    </div>
  );
}

function Report({ report, title, onRestart }: { report: SessionReport; title?: string; onRestart: () => void }) {
  const metrics = [
    { label: "Mistakes per 100 words", value: report.metrics.mistakesPer100, level: report.levels.mistakesPer100, missing: "Not available" },
    { label: "Words per answer", value: report.metrics.wordsPerAnswer, level: report.levels.wordsPerAnswer, missing: "Not available" },
    { label: "Hesitations per minute", value: report.metrics.hesitationsPerMin, level: report.levels.hesitationsPerMin, missing: "Voice sessions only" },
  ];
  const speaking = report.metrics.speakingSeconds;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={title} title="Your session report" />
      <Card>
        <h2 className="text-lg font-semibold">Your tutor's note</h2>
        <p className="mt-2 whitespace-pre-wrap">{report.note}</p>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <p className="text-sm text-muted">{m.label}</p>
            <p className="mt-2 text-3xl font-semibold">{formatNumber(m.value)}</p>
            <div className="mt-2">
              {m.level ? <StatusPill status={m.level} label={LEVEL_LABEL[m.level]} /> : m.value === null && <span className="text-sm text-muted">{m.missing}</span>}
            </div>
          </Card>
        ))}
      </div>
      {speaking !== null && <p className="mt-3 text-sm text-muted">Speaking time: {formatMinutes(speaking / 60)}</p>}

      <Card className="mt-4">
        <h2 className="text-lg font-semibold">Your answers</h2>
        <ol className="mt-3 space-y-3">
          {report.lines.map((line, i) =>
            line.role === "coach" ? (
              <li key={i} className="rounded-2xl bg-black/[0.04] px-4 py-3 text-sm">{line.text}</li>
            ) : (
              <li key={i} className={cn("flex gap-3 rounded-2xl border p-3", i === report.redoIndex ? "border-ink" : "border-line")}>
                <span aria-hidden className={cn("w-1 shrink-0 rounded-full", line.status ? STATUS_BAR[line.status] : "bg-line")} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p>{line.text}</p>
                    {line.status && <StatusPill status={line.status} label={answerLabel(line.status, line.corrections.length)} />}
                  </div>
                  {i === report.redoIndex && <p className="text-sm font-semibold">Redo this answer first</p>}
                  {line.corrections.map((c, j) => (
                    <div key={j} className="rounded-2xl border border-line p-3 text-sm">
                      <p><s className="text-[color:var(--bad)]">{c.original}</s></p>
                      <p className="font-semibold text-[color:var(--good)]">{c.fixed}</p>
                      <p className="text-muted">{c.why}</p>
                    </div>
                  ))}
                </div>
              </li>
            ),
          )}
        </ol>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onRestart}>Practice again</Button>
        <Link href="/practice" className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-black/5">
          Back to practice
        </Link>
      </div>
    </div>
  );
}
