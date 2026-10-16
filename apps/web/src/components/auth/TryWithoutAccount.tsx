import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** On the sign-in and sign-up cards: the no-account path stays one tap away and visible above the forms. */
export default function TryWithoutAccount() {
  return (
    <Link
      href="/ai-chat?scenarioId=visa-us"
      className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 hover:bg-black/[0.04]"
    >
      <span>
        <span className="block text-[14px] font-semibold text-ink">Try it first, no account needed</span>
        <span className="block text-[13px] text-muted">Start a visa interview now · 40 free answers</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-ink" />
    </Link>
  );
}
