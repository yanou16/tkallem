"use client";
import { useProgress } from "@/features/progress/hooks/useProgress";
import ProgressView from "@/features/progress/components/ProgressView";
export default function ProgressPage() {
  const q = useProgress();
  return <ProgressView q={q} />;
}
