import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** On the sign-in and sign-up cards: the no-account path stays one tap away and visible above the forms. */
export default function TryWithoutAccount() {
  return (
    <Link
      href="/ai-chat?scenarioId=visa-us"
      className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[#f7f8fa] px-4 py-3 hover:bg-black/[0.04]"
    >
      <span>
        <span className="block text-[14px] font-semibold text-[#16161a]">Try it first, no account needed</span>
        <span className="block text-sm text-[#6b6b75]">Start a visa interview now · 40 free answers</span>
      </span>
      <ArrowRight size={18} className="shrink-0 text-[#16161a]" />
    </Link>
  );
}
