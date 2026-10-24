"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export default function Miniature({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 0.45, height: 580 });
  useEffect(() => {
    const outer = frame.current, inner = content.current;
    if (!outer || !inner) return;
    const update = () => { const scale = Math.min(outer.clientWidth / 1500, 1); setSize({ scale, height: inner.offsetHeight * scale }); };
    const observer = new ResizeObserver(update);
    observer.observe(outer); observer.observe(inner); update();
    return () => observer.disconnect();
  }, []);
  return <div ref={frame} className="relative w-full" style={{ height: size.height }}><div ref={content} className="absolute left-0 top-0 w-[1500px] origin-top-left" style={{ transform: `scale(${size.scale})` }}>{children}</div></div>;
}
