"use client";

import { redirect } from "next/navigation";
import { useParams } from "next/navigation";
import { Async, ErrorState, Skeleton } from "@/components/ui";
import { FEATURES } from "@/lib/features";
import { useGroup } from "@/features/groups/hooks/useGroups";
import GroupRoom from "@/features/groups/components/GroupRoom";

export default function GroupPage() {
  if (!FEATURES.groups) redirect("/practice");
  const { id } = useParams<{ id: string }>();
  const group = useGroup(id);
  return (
    <Async query={group} skeleton={<Skeleton className="mt-6 h-[500px]" />}>
      {(detail) => detail
        ? <GroupRoom summary={{ ...detail, memberCount: detail.members?.length ?? 0, isMember: true, lastActivity: null, language: { code: "en", name: "English" }, levelRange: detail.level, description: "Practice with learners at your level.", tags: [detail.theme.category], memberAvatars: [] }} />
        : <ErrorState error={group.error} onRetry={() => group.refetch()} className="mt-6" />}
    </Async>
  );
}
