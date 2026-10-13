"use client";
import { redirect } from "next/navigation";
import { useMyGroup } from "@/features/groups/hooks/useGroups";
import GroupRoom from "@/features/groups/components/GroupRoom";
import JoinGroup from "@/features/groups/components/JoinGroup";
import { ErrorState, Skeleton } from "@/components/ui";
import { FEATURES } from "@/lib/features";

/** One group at a time: no group, a button to join one; in a group, the group itself. */
function GroupsPageContent() {
  const mine = useMyGroup();
  if (mine.isLoading) return <Skeleton className="mt-6 h-[500px]" />;
  if (mine.error) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} className="mt-6" />;
  return mine.data ? <GroupRoom key={mine.data.id} summary={mine.data} /> : <JoinGroup />;
}

export default function GroupsPage() {
  if (!FEATURES.groups) redirect("/practice");
  return <GroupsPageContent />;
}
