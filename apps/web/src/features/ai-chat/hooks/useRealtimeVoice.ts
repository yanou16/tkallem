"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { API_URL } from "@/lib/config";
import { endpoints } from "@/lib/api/endpoints";
import { getAuthHeaderValue } from "@/lib/api/client";
import type { CoachState } from "../components/VoiceState";
import type { Correction, SentenceStatus } from "../types/ai";
import { CALL_CONNECT_TIMEOUT_MS, callError, type CallError, type CallTurn } from "../lib/call";

export type CallPhase = "idle" | "connecting" | "live";

type CorrectionEvent = CallTurn & { corrections: Correction[]; sentence_status: SentenceStatus };

export type RealtimeVoiceOptions = {
  sessionId: string | undefined;
  /** The relay servers from GET /sessions/{id}/ice-servers: without them a browser cannot reach the server behind Azure. */
  iceServers: RTCIceServer[];
  onHeard: (text: string) => void;
  onCoachLine: (text: string) => void;
  onTurn: (turn: CallTurn) => void;
  onError: (error: CallError) => void;
  /** Called once the call is over (ended, dropped or failed), to refresh what the server saved. */
  onEnded: () => void;
};

/**
 * The live call with the coach (WebRTC through the relay, Pipecat on the server). The page only decides when to start
 * and stop it; what the call hears and says comes back through the callbacks. A connection that does not open within
 * CALL_CONNECT_TIMEOUT_MS is reported as a timeout, so the student is offered the voice message instead of waiting.
 */
export function useRealtimeVoice(options: RealtimeVoiceOptions) {
  const opts = useRef(options);
  opts.current = options;

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [state, setState] = useState<CoachState>("idle");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const clientRef = useRef<PipecatClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(false);
  const lastCoachLine = useRef("");
  /** The microphone level (0 to 1), written many times a second: a ref, so the page does not render for each one. */
  const levelRef = useRef(0);
  const attempt = useRef(0); // a start that was cancelled while it waited (microphone prompt) must not connect afterwards
  const mutedRef = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const teardown = useCallback(async () => {
    clearTimer();
    attempt.current += 1;
    levelRef.current = 0;
    const client = clientRef.current;
    clientRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    try {
      await client?.disconnect();
    } catch {
      /* already closed */
    }
    startedAt.current = null;
    lastCoachLine.current = "";
    mutedRef.current = false;
    window.speechSynthesis?.cancel();
    setPhase("idle");
    setState("idle");
    setMuted(false);
    setSeconds(0);
  }, []);

  /** Ends the call from the student's side, or after a failure. `failed` keeps the error on screen. */
  const stop = useCallback(async () => {
    const wasOpen = live.current || clientRef.current !== null;
    live.current = false;
    await teardown();
    if (wasOpen) opts.current.onEnded();
  }, [teardown]);

  const fail = useCallback(async (error: unknown, code?: string) => {
    const wasOpen = clientRef.current !== null;
    live.current = false;
    await teardown();
    opts.current.onError(callError(error, code));
    if (wasOpen) opts.current.onEnded();
  }, [teardown]);

  /** The server could not make the coach's voice (daily quota, outage): the call goes on and the browser reads the line.
   *  The microphone is closed while it reads, or the call would hear the browser's voice as the student's. */
  const speakWithBrowser = (client: PipecatClient) => {
    const text = lastCoachLine.current;
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const done = () => {
      setState("idle");
      if (clientRef.current === client && !mutedRef.current) client.enableMic(true);
    };
    u.onstart = () => {
      setState("speaking");
      client.enableMic(false);
    };
    u.onend = u.onerror = done;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const start = useCallback(async () => {
    const { sessionId, iceServers } = opts.current;
    if (!sessionId || clientRef.current) return;
    const mine = ++attempt.current;
    setPhase("connecting");
    try {
      // The audio element is made inside the tap, so the browser lets it play the coach's voice later.
      const el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "");
      document.body.appendChild(el);
      audioRef.current = el;

      // The microphone is asked for here, inside the tap and before anything connects: the call client carries on without
      // a microphone when it is refused, and the student would sit in a call nobody hears. No 12 s limit while the prompt is open.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      if (attempt.current !== mine) return; // cancelled while the browser asked for the microphone

      const headers = new Headers();
      const auth = await getAuthHeaderValue();
      if (attempt.current !== mine) return;
      if (auth) headers.set("Authorization", auth);

      const transport = new SmallWebRTCTransport({
        iceServers,
        webrtcRequestParams: { endpoint: `${API_URL}${endpoints.ai.webrtc(sessionId)}`, headers },
      });
      const client = new PipecatClient({ transport, enableMic: true, enableCam: false });
      clientRef.current = client;

      const play = (track: MediaStreamTrack) => {
        if (!audioRef.current || track.kind !== "audio") return;
        audioRef.current.srcObject = new MediaStream([track]);
        void audioRef.current.play().catch(() => undefined);
      };
      const opened = () => {
        if (live.current) return;
        live.current = true;
        clearTimer();
        startedAt.current = performance.now();
        setPhase("live");
        setState("idle");
        try {
          const bot = client.tracks()?.bot?.audio;
          if (bot) play(bot);
        } catch {
          /* the bot's track comes with TrackStarted */
        }
      };

      client.on(RTVIEvent.Connected, opened);
      client.on(RTVIEvent.BotReady, opened);
      client.on(RTVIEvent.TrackStarted, (track: MediaStreamTrack, participant?: { local?: boolean }) => {
        if (!participant?.local) play(track);
      });
      client.on(RTVIEvent.Disconnected, () => {
        if (clientRef.current === client && live.current) void stop();
      });
      client.on(RTVIEvent.LocalAudioLevel, (level: number) => { levelRef.current = level; });
      client.on(RTVIEvent.UserStartedSpeaking, () => setState("listening"));
      client.on(RTVIEvent.UserStoppedSpeaking, () => setState("thinking"));
      client.on(RTVIEvent.BotStartedSpeaking, () => setState("speaking"));
      client.on(RTVIEvent.BotStoppedSpeaking, () => setState("idle"));
      // What is heard and said comes from our own server messages (whole lines, one per turn), not from the transcription events.
      client.on(RTVIEvent.ServerMessage, (data: { type?: string; text?: string; code?: string; detail?: string; message?: string } & Partial<CorrectionEvent>) => {
        if (data?.type === "user_transcript" && data.text) opts.current.onHeard(data.text);
        else if (data?.type === "bot_transcript" && data.text) {
          lastCoachLine.current = data.text;
          opts.current.onCoachLine(data.text);
        } else if (data?.type === "error" && data.code === "tts_error") speakWithBrowser(client);
        else if (data?.type === "correction" && data.original !== undefined && data.reply !== undefined) opts.current.onTurn(data as CallTurn);
        else if (data?.type === "error") void fail(new Error(String(data.detail ?? data.message ?? data.code ?? "call error")), data.code);
      });
      client.on(RTVIEvent.Error, (err: unknown) => void fail(err));

      timer.current = setTimeout(() => {
        if (!live.current) {
          const timeout = new Error("The call did not connect in time");
          timeout.name = "CallTimeout";
          void fail(timeout);
        }
      }, CALL_CONNECT_TIMEOUT_MS);

      await client.connect();
    } catch (err) {
      if (clientRef.current || audioRef.current) await fail(err);
    }
  }, [fail, stop]);

  const toggleMute = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    const next = !muted;
    client.enableMic(!next);
    mutedRef.current = next;
    setMuted(next);
  }, [muted]);

  useEffect(() => {
    if (phase !== "live") return;
    const tick = window.setInterval(() => {
      if (startedAt.current !== null) setSeconds((performance.now() - startedAt.current) / 1000);
    }, 500);
    return () => window.clearInterval(tick);
  }, [phase]);

  // Leaving the page hangs up.
  useEffect(() => () => {
    clearTimer();
    audioRef.current?.remove();
    void clientRef.current?.disconnect().catch(() => undefined);
    clientRef.current = null;
  }, []);

  return { phase, state, muted, seconds, levelRef, start, stop, toggleMute };
}
