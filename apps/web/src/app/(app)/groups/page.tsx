"use client";
import { redirect } from "next/navigation";
import { useMyGroup } from "@/features/groups/hooks/useGroups";
import GroupRoom from "@/features/groups/components/GroupRoom";
import JoinGroup from "@/features/groups/components/JoinGroup";
import { ErrorState, Skeleton } from "@/components/ui";
import GuestGroups from "@/features/groups/components/GuestGroups";
import { useIdentity } from "@/features/credits/hooks/useCredits";
import { FEATURES } from "@/lib/features";

/** One group at a time: no group, a button to join one; in a group, the group itself. */
function GroupsPageContent() {
  const mine = useMyGroup();
  if (mine.isLoading) return <div className="p-6 md:p-10"><Skeleton className="h-[500px]" /></div>;
  if (mine.error) return <div className="p-6 md:p-10"><ErrorState error={mine.error} onRetry={() => mine.refetch()} /></div>;
  return mine.data ? <GroupRoom key={mine.data.id} summary={mine.data} /> : <div className="p-6 md:p-10"><JoinGroup /></div>;
}

export default function GroupsPage() {
  const { ready, isGuest } = useIdentity();
  if (!FEATURES.groups) redirect("/practice");
  if (!ready) return <div className="p-6 md:p-10"><Skeleton className="h-[500px]" /></div>; // who is looking decides which calls are made
  return isGuest ? <div className="p-6 md:p-10"><GuestGroups /></div> : <GroupsPageContent />;
}
