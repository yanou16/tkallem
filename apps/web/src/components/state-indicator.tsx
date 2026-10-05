"use client";

import { motion } from "framer-motion";

export function ListeningBars() {
  return (
    <div className="flex h-8 items-center gap-1" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span
          key={i}
          className="h-8 w-1 origin-center rounded-full bg-ink"
          animate={{ scaleY: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.06, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
