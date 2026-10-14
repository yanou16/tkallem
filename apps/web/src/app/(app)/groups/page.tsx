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
  if (mine.isLoading) return <Skeleton className="mt-6 h-[500px]" />;
  if (mine.error) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} className="mt-6" />;
  return mine.data ? <GroupRoom key={mine.data.id} summary={mine.data} /> : <JoinGroup />;
}

export default function GroupsPage() {
  const { ready, isGuest } = useIdentity();
  if (!FEATURES.groups) redirect("/practice");
  if (!ready) return <Skeleton className="mt-6 h-[500px]" />; // who is looking decides which calls are made
  return isGuest ? <GuestGroups /> : <GroupsPageContent />;
}
