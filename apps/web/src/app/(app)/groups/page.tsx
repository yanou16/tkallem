"use client";

import { redirect } from "next/navigation";
import { Async, Skeleton } from "@/components/ui";
import { FEATURES } from "@/lib/features";
import { useIdentity } from "@/features/credits/hooks/useCredits";
import { useMyGroup } from "@/features/groups/hooks/useGroups";
import GuestGroups from "@/features/groups/components/GuestGroups";
import JoinGroup from "@/features/groups/components/JoinGroup";
import GroupRoom from "@/features/groups/components/GroupRoom";

export default function GroupsPage() {
  if (!FEATURES.groups) redirect("/practice");
  const { isGuest } = useIdentity();
  if (isGuest) return <GuestGroups />;

  const group = useMyGroup();
  return (
    <Async query={group} skeleton={<Skeleton className="mt-6 h-[500px]" />}>
      {(summary) => summary ? <GroupRoom summary={summary} /> : <JoinGroup />}
    </Async>
  );
}
