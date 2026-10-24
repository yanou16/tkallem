"use client";
import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronDown, House, MessageCircle, Sparkles, Users, ChartNoAxesColumn, UserRound, BookOpen, LogOut } from "lucide-react";
import { Avatar, ErrorState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/config";
import { ApiError, setUnauthorizedHandler } from "@/lib/api/client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import CreditsPill from "@/components/CreditsPill";
import ChooseLevel from "@/components/ChooseLevel";
import { useIdentity } from "@/features/credits/hooks/useCredits";
import { FEATURES } from "@/lib/features";

export function isActive(path: string | null, href: string, aliases: string[] = []) {
  return path !== null && [href, ...aliases].some((route) => route === "/" ? path === "/" : path === route || path.startsWith(route + "/"));
}

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/practice", label: "Practice", icon: MessageCircle },
  { href: "/ai-chat", label: "AI Chat", icon: Sparkles },
  ...(FEATURES.groups ? [{ href: "/groups", label: "Groups", icon: Users }] : []),
  { href: "/phrases", label: "Your phrases", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/profile", label: "Profile", icon: UserRound },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 sm:gap-3 sm:px-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-extrabold">T</span>
      <span className="text-lg font-bold tracking-tight sm:text-2xl">Tkallem</span>
    </Link>
  );
}

/** A visitor without account only sees the screens that work without one. */
const GUEST_NAV = NAV.filter((n) => n.href === "/phrases" || n.href === "/practice" || n.href === "/ai-chat" || n.href === "/groups");
function useNav() {
  return useIdentity().isGuest ? GUEST_NAV : NAV;
}

function Sidebar() {
  const path = usePathname();
  const nav = useNav();
  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col gap-8 border-r border-line bg-white/60 p-5 md:flex">
      <Logo />
      <nav className="flex flex-col gap-1.5" aria-label="Main">
        {nav.map(({ href, label, icon: I }) => {
          const active = isActive(path, href);
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
  const nav = useNav().filter((n) => n.href !== "/phrases");
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-white/95 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
      {nav.map(({ href, label, icon: I }) => {
        const active = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] sm:text-[11px]", active ? "font-semibold text-ink" : "text-muted")}>
            <I size={20} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}

function HeaderBar({ isGroups }: { isGroups?: boolean }) {
  const { user, isLoaded } = useUser();
  const { user: appUser } = useCurrentUser();
  const { signOut } = useClerk();
  const { isGuest } = useIdentity();
  const [open, setOpen] = useState(false);

  const avatarSrc = appUser?.avatarUrl || user?.imageUrl;
  const displayName = appUser?.firstName || user?.firstName || user?.primaryEmailAddress?.emailAddress;

  return (
    <div className={cn("flex shrink-0 items-center justify-between",
      isGroups ? "border-b border-line/60 px-4 py-2.5 sm:px-6 md:justify-end md:px-8" : "px-4 py-3 sm:px-6 md:justify-end md:px-10 md:pb-0 md:pt-5")}>
      <div className="md:hidden"><Logo /></div>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-5">
        <Link href="/phrases" aria-label="Your phrases" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-lilac md:hidden"><BookOpen size={20} /></Link>
        <CreditsPill />
        {FEATURES.notifications && (
          <button aria-label="Notifications" className="relative rounded-full p-2 hover:bg-black/5">
            <Bell size={22} strokeWidth={1.7} />
          </button>
        )}
        {isGuest ? (
          <Link href={ROUTES.signIn} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Sign in</Link>
        ) : !isLoaded || !user ? (
          <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 !rounded-full" /><Skeleton className="hidden h-4 w-16 sm:block" /></div>
        ) : (
          <div className="relative">
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 rounded-full p-1 pr-2 hover:bg-black/5" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open}>
              <Avatar src={avatarSrc} first={appUser?.firstName ?? user.firstName ?? undefined} last={appUser?.lastName ?? user.lastName ?? undefined} size={40} />
              <span className="hidden max-w-40 truncate font-medium sm:block">{displayName}</span>
              <ChevronDown size={16} className="hidden sm:block" />
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
  const path = usePathname();
  const { user, error, refetch, hasProfile, isGuest } = useCurrentUser();
  const { guestFailed } = useIdentity();
  const needsLevel = hasProfile && !isGuest && !user?.level; // new account: no session can start without a level
  const isGroups = isActive(path, "/groups");

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
      <div className={cn("min-w-0 flex-1 flex flex-col", isGroups ? "h-dvh overflow-hidden pb-[calc(61px+env(safe-area-inset-bottom))] md:pb-0" : "min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0")}>
        <HeaderBar isGroups={isGroups} />
        <main className={cn("flex-1 min-h-0 flex flex-col", isGroups ? "p-0" : "px-4 pb-6 pt-2 sm:px-6 md:px-10 md:pb-10")}>
          {fatal ? <ErrorState error={error} onRetry={() => refetch()} className={cn(isGroups ? "m-6" : "mt-8")} />
            : !user && !error && guestFailed ? <div className={cn(isGroups && "p-6")}><GuestUnavailable /></div>
            : !user && !error ? <div className={cn(isGroups && "p-6")}><PageSkeleton /></div>
            : needsLevel ? <div className={cn(isGroups && "p-6")}><ChooseLevel /></div> : children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function GuestUnavailable() {
  return (
    <div className="mt-8 max-w-md rounded-2xl border border-line bg-white p-5">
      <p className="text-lg font-semibold">Please sign in to start</p>
      <p className="mt-1 text-sm text-muted">Practice without an account is not available right now. Signing in is free and gives you credits to practise.</p>
      <Link href={ROUTES.signUp} className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Create a free account</Link>
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
