import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HOW_STEPS, PRIVACY_LINE } from "./howSteps";

/**
 * "How it works" (welcome page): the loop in four lines, each with the real screen it talks about. No icons, no cards:
 * a number, one short line, the picture. The call to action comes back after the last step.
 */
export default function HowItWorks({ ctaHref, ctaLabel }: { ctaHref: string; ctaLabel: string }) {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-6">
      <h2 id="how-title" className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
      <p className="mt-2 max-w-xl text-lg text-charcoal">Four steps, about ten minutes. See what each one looks like.</p>

      <ol className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {HOW_STEPS.map((s, i) => (
          <li key={s.n} className={`flex flex-col gap-5 rounded-card p-5 sm:p-6 ${["bg-peach/40", "bg-mint/40", "bg-butter/40", "bg-lilac/40"][i]}`}>
            <p className="flex items-center gap-3 text-lg font-semibold leading-snug">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-base font-semibold text-white">{s.n}</span>
              <span><span className="sr-only">Step {s.n}: </span>{s.line}</span>
            </p>
            <Image src={s.src} alt={s.alt} width={s.w} height={s.h} sizes="(min-width: 1024px) 270px, (min-width: 640px) 45vw, 92vw"
              className="h-auto w-full max-w-[390px] rounded-[20px] border border-hairline" />
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <Link href={ctaHref} className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-6 py-4 text-base font-semibold text-white hover:bg-black/80 sm:text-lg">
          {ctaLabel} <ArrowRight size={20} aria-hidden />
        </Link>
        <p className="text-base text-charcoal">{PRIVACY_LINE}</p>
      </div>
    </section>
  );
}
