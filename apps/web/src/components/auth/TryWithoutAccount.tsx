import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** On the sign-in and sign-up cards: the no-account path stays one tap away and visible above the forms. */
export default function TryWithoutAccount() {
  return (
    <Link
      href="/ai-chat?scenarioId=visa-us"
      className="mb-5 flex min-h-12 items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-white px-4 py-3 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span>
        <span className="block text-base font-semibold text-ink">Try it first, no account needed</span>
        <span className="block text-sm text-slate">Start a visa interview now · 40 free answers</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-ink" />
    </Link>
  );
}
