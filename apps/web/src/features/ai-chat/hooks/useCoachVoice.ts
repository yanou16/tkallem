"use client";
import { useCallback, useRef, useState } from "react";
import type { AvatarSpeech } from "@/components/CoachAvatar";

type Line = { url: string | null; text: string };

/** Last resort when the server could not make the coach's voice (quota, outage): the browser's own English voice. */
function speakWithBrowser(text: string, setSpeaking: (v: boolean) => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.onstart = () => setSpeaking(true);
  u.onend = u.onerror = () => setSpeaking(false);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * Plays the coach's lines: through the 3D coach when it is shown and works, otherwise a plain audio element, and the
 * browser's voice when the server sent no audio. When the browser blocks sound before a tap (autoplay rules), the line
 * is kept in `blocked` so the page can offer a "Listen" button.
 */
export function useCoachVoice(useAvatar: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const [speech, setSpeech] = useState<AvatarSpeech | null>(null);
  const [blocked, setBlocked] = useState<Line | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeech(null);
    setSpeaking(false);
  }, []);

  const play = useCallback(
    (url: string | null | undefined, text: string) => {
      stop();
      setBlocked(null);
      if (!url) {
        speakWithBrowser(text, setSpeaking);
        return;
      }
      if (useAvatar && !avatarBroken) {
        setSpeech({ id: Date.now(), url, text });
        return;
      }
      const a = new Audio(url);
      audio.current = a;
      a.onplay = () => setSpeaking(true);
      a.onended = a.onerror = () => setSpeaking(false);
      a.play().catch(() => {
        setSpeaking(false);
        setBlocked({ url, text });
      });
    },
    [useAvatar, avatarBroken, stop],
  );

  return {
    speaking,
    speech,
    blocked,
    play,
    stop,
    replayBlocked: () => blocked && play(blocked.url, blocked.text),
    avatarProps: {
      speech,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onBlocked: (s: AvatarSpeech) => { setSpeaking(false); setBlocked({ url: s.url, text: s.text }); },
      onUnavailable: () => setAvatarBroken(true),
    },
  };
}
