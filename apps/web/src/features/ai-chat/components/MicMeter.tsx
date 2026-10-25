"use client";
import { useEffect, useRef, type MutableRefObject } from "react";

const BARS = 14;
/** A fixed, uneven profile so the strip reads as a voice and not as a block: only the height of each bar follows the level. */
const PROFILE = Array.from({ length: BARS }, (_, i) => 0.45 + 0.55 * Math.abs(Math.sin(i * 1.7)));

/**
 * Proof that the microphone hears the student, before the first word and in a room where the server's voice detector
 * never fires. The level is read from a ref and written straight to each bar's transform: no render per frame, and
 * only `transform` animates (nothing to lay out or paint). Muted: flat and grey.
 */
export default function MicMeter({ levelRef, muted, className }: { levelRef: MutableRefObject<number>; muted: boolean; className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    let smooth = 0;
    const tick = () => {
      const target = muted ? 0 : Math.min(1, levelRef.current * 2.4); // speech sits low on the 0 to 1 scale
      smooth += (target - smooth) * 0.35;
      bars.current.forEach((el, i) => {
        if (el) el.style.transform = `scaleY(${Math.max(0.12, smooth * PROFILE[i])})`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [levelRef, muted]);
  return (
    <span aria-hidden className={`flex h-8 items-center gap-[3px] ${className ?? ""}`}>
      {PROFILE.map((_, i) => (
        <span key={i} ref={(el) => { bars.current[i] = el; }} className={`h-8 w-[3px] rounded-full ${muted ? "bg-stone" : "bg-ink"}`} style={{ transform: "scaleY(0.12)" }} />
      ))}
    </span>
  );
}
