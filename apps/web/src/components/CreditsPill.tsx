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
      title={isGuest ? "Sign up to get 60 more credits and new ones every day" : "1 credit = 1 answer. New credits arrive every day."}
    >
      <Zap size={15} strokeWidth={2} aria-hidden /> {data.balance} <span className="font-normal text-muted">credits</span>
    </span>
  );
  return isGuest ? <Link href="/sign-up" aria-label={`${data.balance} credits left. Sign up for more`}>{pill}</Link> : pill;
}
