"use client";
import Image from "next/image";
import { AlertCircle, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

/* ---------- neutral tones (visual only; assigned by position, never from data) ---------- */
export const TONES = ["surface"] as const;
export type Tone = (typeof TONES)[number];
export const toneAt = (i: number): Tone => TONES[i % TONES.length];
export const toneBg: Record<Tone, string> = { surface: "bg-surface" };
export const toneDeep: Record<Tone, string> = { surface: "bg-white" };

/* ---------- primitives ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-black/[0.06]", className)} aria-hidden />;
}

export function Avatar({ src, first, last, size = 40, className }: { src?: string; first?: string; last?: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src)
    return <Image src={src} alt="" width={size} height={size} unoptimized style={style} className={cn("rounded-full object-cover", className)} />;
  return (
    <span style={{ ...style, fontSize: size * 0.38 }} className={cn("inline-flex items-center justify-center rounded-full bg-black/[0.06] font-semibold text-ink", className)} aria-hidden>
      {initials(first, last)}
    </span>
  );
}

export function AvatarStack({ people, size = 34, max = 3 }: { people: { id: string; name: string; avatarUrl?: string }[]; size?: number; max?: number }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} src={p.avatarUrl} first={p.name} size={size} className="ring-2 ring-white" />
      ))}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-ink", className)}>{children}</span>;
}

export function Button({ dark = true, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { dark?: boolean }) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        dark ? "bg-ink text-white hover:bg-black/80" : "border border-line bg-white text-ink hover:bg-black/5",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-card border border-line bg-white p-5", className)}>{children}</section>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {action && <div className="text-sm text-muted">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: ReactNode; title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="mb-1 text-sm text-muted">{eyebrow}</p>}
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      {subtitle && <p className="mt-2 text-lg text-muted">{subtitle}</p>}
    </header>
  );
}

/* ---------- states ---------- */
export function EmptyState({ title, text, action, className }: { title: string; text: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-line bg-white/60 p-6 text-center", className)}>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  const msg = error instanceof ApiError ? error.message : "Something went wrong while loading this section.";
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-2xl border border-line bg-bad-bg p-4 text-bad", className)}>
      <AlertCircle className="mt-0.5 shrink-0" size={18} />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Couldn't load this</p>
        <p className="text-muted">{msg}</p>
      </div>
      {onRetry && <Button dark={false} onClick={onRetry} className="!px-3 !py-1.5 text-xs">Try again</Button>}
    </div>
  );
}

/** Renders skeleton / error / empty / data for any TanStack query result. */
export function Async<T>({
  query, skeleton, empty, isEmpty, children,
}: {
  query: { data?: T; isLoading: boolean; error: unknown; refetch: () => unknown };
  skeleton: ReactNode;
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
  children: (d: NonNullable<T>) => ReactNode;
}) {
  if (query.isLoading) return <>{skeleton}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined || query.data === null) return <>{empty ?? null}</>;
  if (isEmpty?.(query.data)) return <>{empty ?? null}</>;
  return <>{children(query.data as NonNullable<T>)}</>;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-ink" : "bg-black/15", disabled && "opacity-50")}
    >
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-card bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-black/5"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProgressRing({ value, max, size = 120, stroke = 12, children }: { value: number; max: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ececf0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1DB87E" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function GoalHint({ goal, done }: { goal: number; done: number }) {
  const left = Math.max(0, goal - done);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-success/10 p-3 text-sm text-muted">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">✿</span>
      {left > 0 ? <p>You're {left} minute{left === 1 ? "" : "s"} away from your daily goal!</p> : <p>Daily goal reached. Nice work!</p>}
    </div>
  );
}
