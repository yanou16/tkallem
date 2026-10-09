"use client";
import { useCallback, useRef, useState } from "react";

/** Browser-side recording only. Upload/processing states are driven by the caller. */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.start();
      recorder.current = r;
      setIsRecording(true);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser settings.");
    }
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const r = recorder.current;
        if (!r) return resolve(null);
        r.onstop = () => {
          r.stream.getTracks().forEach((t) => t.stop());
          setIsRecording(false);
          resolve(new Blob(chunks.current, { type: r.mimeType || "audio/webm" }));
        };
        r.stop();
      }),
    [],
  );

  return { isRecording, error, start, stop };
}
