"use client";
import { Avatar, Card, ErrorState, Pill, Skeleton } from "@/components/ui";
import { cn, formatMinutes, plural } from "@/lib/utils";
import type { LeaderboardEntry } from "../types/groups";
import { memberName } from "../lib/labels";

type Query = { data?: LeaderboardEntry[]; isLoading: boolean; error: unknown; refetch: () => unknown };

/** Practice time of each member over the last 7 days, then the streak, as computed by the API (ties share a rank). */
export default function Leaderboard({ query }: { query: Query }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <Pill className="border border-line">Last 7 days</Pill>
      </div>
      {query.isLoading ? <Skeleton className="h-40" />
        : query.error ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
        : (
          <ol className="divide-y divide-line">
            {(query.data ?? []).map((e) => (
              <li key={e.member.id} className={cn("flex items-center gap-3 py-3", e.isMe && "font-semibold")}>
                <span className="w-5 text-center">{e.rank}</span>
                <Avatar first={e.member.firstName ?? undefined} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{memberName(e.member, e.isMe)}</p>
                  <p className="text-xs font-normal text-muted">Streak: {plural(e.streakDays, "day")}</p>
                </div>
                <span className="text-sm">{formatMinutes(e.weekSeconds / 60)}</span>
              </li>
            ))}
          </ol>
        )}
    </Card>
  );
}
