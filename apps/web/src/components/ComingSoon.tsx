import Link from "next/link";
import { EmptyState } from "@/components/ui";

/** Shown instead of a screen whose backend is not built yet (see lib/features.ts). */
export default function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <EmptyState
      className="mt-8"
      title={title}
      text={text}
      action={<Link href="/practice" className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Practise now</Link>}
    />
  );
}
