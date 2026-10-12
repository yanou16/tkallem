"use client";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_RECORDING_S, RECORDING_ERRORS, judgeRecording } from "../lib/voice";

export { MAX_RECORDING_S };

export type Recording = { blob: Blob; seconds: number };

/** Browser-side recording only. Upload/processing states are driven by the caller. */
export function useVoiceRecorder({ onAutoStop }: { onAutoStop?: (r: Recording | null) => void } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const peak = useRef(0);
  const meter = useRef<{ ctx: AudioContext; timer: number } | null>(null);
  const autoStop = useRef(onAutoStop);
  autoStop.current = onAutoStop;

  const stop = useCallback(
    () =>
      new Promise<Recording | null>((resolve) => {
        const r = recorder.current;
        if (!r || r.state === "inactive") return resolve(null);
        r.onstop = () => {
          r.stream.getTracks().forEach((t) => t.stop());
          stopMeter();
          recorder.current = null;
          setIsRecording(false);
          const length = (performance.now() - startedAt.current) / 1000;
          const verdict = judgeRecording(length, peak.current);
          if (verdict !== "ok") {
            setError(RECORDING_ERRORS[verdict]);
            return resolve(null);
          }
          resolve({ blob: new Blob(chunks.current, { type: r.mimeType || "audio/webm" }), seconds: length });
        };
        r.stop();
      }),
    [],
  );

  function stopMeter() {
    if (!meter.current) return;
    window.clearInterval(meter.current.timer);
    meter.current.ctx.close().catch(() => undefined);
    meter.current = null;
  }

  /** Follows the input level while recording. If the browser cannot measure it, peak stays -1 and nothing is blocked. */
  function startMeter(stream: MediaStream) {
    peak.current = -1;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      peak.current = 0;
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        peak.current = Math.max(peak.current, Math.sqrt(sum / buf.length));
      }, 100);
      meter.current = { ctx, timer };
    } catch {
      peak.current = -1;
    }
  }

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot record audio. Type your answer, or open Tkallem in Chrome or Safari.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.start();
      startMeter(stream);
      recorder.current = r;
      startedAt.current = performance.now();
      setSeconds(0);
      setIsRecording(true);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser settings, or type your answer.");
    }
  }, []);

  // Timer, and automatic stop at the maximum length (the answer is still sent).
  useEffect(() => {
    if (!isRecording) return;
    const t = window.setInterval(() => {
      const s = (performance.now() - startedAt.current) / 1000;
      setSeconds(s);
      if (s >= MAX_RECORDING_S) stop().then((r) => autoStop.current?.(r));
    }, 250);
    return () => window.clearInterval(t);
  }, [isRecording, stop]);

  // Release the microphone if the page is left while recording.
  useEffect(() => () => { recorder.current?.stream.getTracks().forEach((t) => t.stop()); stopMeter(); }, []);

  return { isRecording, seconds, error, start, stop, clearError: () => setError(null) };
}
