"use client";

import { useEffect, useRef, useState } from "react";

export type AvatarSpeech = { id: number; url: string; text: string };

/** 3D coach that lip-syncs the audio our API already returns (TalkingHead, MIT). Experimental: the avatar file in
 *  /public/avatars is a sample from the library (non-commercial licence), to be replaced before production. */
export function CoachAvatar({ speech, onStart, onEnd }: { speech: AvatarSpeech | null; onStart?: () => void; onEnd?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [detail, setDetail] = useState("");
  const done = useRef({ onStart, onEnd });
  done.current = { onStart, onEnd };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { TalkingHead } = await import("@met4citizen/talkinghead");
        if (dead || !box.current) return;
        const h = new TalkingHead(box.current, {
          ttsEndpoint: null, lipsyncModules: ["en"], cameraView: "head", cameraRotateEnable: false, cameraZoomEnable: false, cameraPanEnable: false,
        });
        await h.showAvatar({ url: "/avatars/coach.glb", body: "F", avatarMood: "neutral", lipsyncLang: "en" });
        if (dead) { h.stop?.(); return; }
        head.current = h;
        if (process.env.NODE_ENV !== "production") (window as any).__coachHead = h; // handy for manual tests
        setState("ready");
      } catch (e) {
        console.error("3D coach failed", e);
        setDetail(String((e as Error)?.stack ?? e).slice(0, 600));
        setState("failed");
      }
    })();
    return () => { dead = true; try { head.current?.stop?.(); } catch {} head.current = null; };
  }, []);

  useEffect(() => {
    const h = head.current;
    if (!speech || state !== "ready" || !h) return;
    let cancelled = false;
    (async () => {
      try {
        const ctx: AudioContext = h.audioCtx;
        await ctx.resume();
        const buf = await ctx.decodeAudioData(await (await fetch(speech.url)).arrayBuffer());
        if (cancelled) return;
        const words = speech.text.split(/\s+/).filter(Boolean);
        const weight = words.map((w) => w.length + 2);
        const total = weight.reduce((a, b) => a + b, 0);
        const ms = buf.duration * 1000;
        let t = 0;
        const wtimes = weight.map((w) => { const s = t; t += (w / total) * ms; return s; });
        const wdurations = weight.map((w) => (w / total) * ms);
        done.current.onStart?.();
        h.speakAudio({ audio: buf, words, wtimes, wdurations }, { lipsyncLang: "en" });
        window.setTimeout(() => done.current.onEnd?.(), ms + 300);
      } catch (e) {
        setDetail(String((e as Error)?.message ?? e));
        done.current.onEnd?.();
      }
    })();
    return () => { cancelled = true; };
  }, [speech?.id, state]);

  return (
    <div className="relative mx-auto h-64 w-full max-w-xs overflow-hidden rounded-2xl bg-black/[0.03] md:h-80" data-avatar-state={state}>
      <div ref={box} className="h-full w-full" />
      {state === "loading" && <p className="absolute inset-0 grid place-items-center text-sm text-muted">Loading your coach…</p>}
      {state === "failed" && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted">3D coach unavailable on this device. {detail}</p>}
    </div>
  );
}
