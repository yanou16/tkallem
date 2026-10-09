"use client";
import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronDown, House, MessageCircle, Sparkles, Users, ChartNoAxesColumn, UserRound, LogOut } from "lucide-react";
import { Avatar, ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/config";
import { ApiError, setUnauthorizedHandler } from "@/lib/api/client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useUnreadCount } from "@/features/profile/hooks/useProfile";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/practice", label: "Practice", icon: MessageCircle },
  { href: "/ai-chat", label: "AI Chat", icon: Sparkles },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold">T</span>
      <span className="text-2xl font-bold tracking-tight">Tkallem</span>
    </Link>
  );
}

function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col gap-8 border-r border-line bg-white/60 p-5 md:flex">
      <Logo />
      <nav className="flex flex-col gap-1.5" aria-label="Main">
        {NAV.map(({ href, label, icon: I }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-4 rounded-full px-5 py-3.5 text-[15px] font-medium transition",
                active ? "bg-ink text-white" : "text-muted hover:bg-black/5")}>
              <I size={22} strokeWidth={1.7} /> {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-white/95 py-2 md:hidden">
      {NAV.map(({ href, label, icon: I }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 px-2 text-[11px]", active ? "font-semibold text-ink" : "text-muted")}>
            <I size={20} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

function HeaderBar() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-6 pt-5 md:justify-end md:px-10">
      <div className="md:hidden"><Logo /></div>
      <div className="flex items-center gap-5">
        <button aria-label="Notifications" className="relative rounded-full p-2 hover:bg-black/5">
          <Bell size={22} strokeWidth={1.7} />
          {(unread.data?.count ?? 0) > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />}
        </button>
        {!isLoaded || !user ? (
          <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 !rounded-full" /><Skeleton className="h-4 w-16" /></div>
        ) : (
          <div className="relative">
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 rounded-full p-1 pr-2 hover:bg-black/5" aria-haspopup="menu" aria-expanded={open}>
              <Avatar src={user.imageUrl} first={user.firstName ?? undefined} last={user.lastName ?? undefined} size={40} />
              <span className="font-medium">{user.firstName ?? user.primaryEmailAddress?.emailAddress}</span>
              <ChevronDown size={16} />
            </button>
            {open && (
              <div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-soft">
                <Link href="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/5"><UserRound size={16} /> Profile</Link>
                <button role="menuitem" onClick={() => signOut({ redirectUrl: ROUTES.signIn })} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-black/5"><LogOut size={16} /> Sign out</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Auth guard + chrome. No user data is rendered until the backend answers. */
export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, error, refetch } = useCurrentUser();

  useEffect(() => {
    setUnauthorizedHandler(() => router.replace(ROUTES.signIn));
    return () => setUnauthorizedHandler(null);
  }, [router]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace(ROUTES.signIn);
  }, [error, router]);

  const fatal = error && !(error instanceof ApiError && error.status === 401);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <HeaderBar />
        <main className="px-6 pb-10 pt-2 md:px-10">
          {fatal ? <ErrorState error={error} onRetry={() => refetch()} className="mt-8" /> : !user && !error ? <PageSkeleton /> : children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 pt-6">
      <Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-5 w-1/2" />
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
    </div>
  );
}
