"use client";
import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import type { CreditErrorDetail } from "../types/credits";

/** True when the error means "no credits" (402) or "today's free practice is used up" (429). */
export const isCreditError = (e: unknown): e is ApiError => e instanceof ApiError && (e.status === 402 || e.status === 429);

function comeBackText(iso: string | null | undefined) {
  if (!iso) return "tomorrow";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function OutOfCredits({ error, isGuest }: { error: ApiError; isGuest: boolean }) {
  const detail = ((error.data as { detail?: CreditErrorDetail } | undefined)?.detail ?? {}) as CreditErrorDetail;
  let title: string, text: string, cta: { href: string; label: string } | null = null;

  if (error.status === 429 || detail.code === "daily_budget_reached") {
    title = "Today's free practice is used up";
    text = "A lot of students practiced today. Come back tomorrow, your answers are safe.";
  } else if (isGuest) {
    title = "You used your free answers";
    text = "Create a free account to get 60 more answers, and new answers every day.";
    cta = { href: "/sign-up", label: "Create a free account" };
  } else {
    title = "No answers left";
    text = `New answers arrive ${comeBackText(detail.next_refill_at)}. Keep practicing then.`;
  }

  return (
    <div role="alert" className="rounded-2xl border border-line bg-white p-5">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
      {cta && <Link href={cta.href} className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">{cta.label}</Link>}
    </div>
  );
}
