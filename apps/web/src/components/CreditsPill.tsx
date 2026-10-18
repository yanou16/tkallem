"use client";
import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCredits, useIdentity } from "@/features/credits/hooks/useCredits";

/** Credits left, in the header. A guest taps it to sign up (60 more credits, then daily ones). */
export default function CreditsPill() {
  const { isGuest } = useIdentity();
  const { data } = useCredits();
  if (!data) return null;
  const low = data.balance <= 5;
  const pill = (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
        low ? "border-[color:var(--warn)] bg-[color:var(--warn-bg)] text-[color:var(--warn)]" : "border-line bg-white text-ink")}
      title={isGuest ? "Sign up to get 60 more answers and new ones every day" : "Each answer you send uses one. New answers arrive every day."}
    >
      <Zap size={15} strokeWidth={2} aria-hidden /> {data.balance} <span className="font-normal text-muted max-[399px]:sr-only">answers</span>
    </span>
  );
  return isGuest ? <Link href="/sign-up" aria-label={`${data.balance} answers left. Sign up for more`} className="shrink-0 py-1.5">{pill}</Link> : pill;
}
