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

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const teardown = useCallback(async () => {
    clearTimer();
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

  const start = useCallback(async () => {
    const { sessionId, iceServers } = opts.current;
    if (!sessionId || clientRef.current) return;
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

      const headers = new Headers();
      const auth = await getAuthHeaderValue();
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
      client.on(RTVIEvent.UserStartedSpeaking, () => setState("listening"));
      client.on(RTVIEvent.UserStoppedSpeaking, () => setState("thinking"));
      client.on(RTVIEvent.BotStartedSpeaking, () => setState("speaking"));
      client.on(RTVIEvent.BotStoppedSpeaking, () => setState("idle"));
      // What is heard and said comes from our own server messages (whole lines, one per turn), not from the transcription events.
      client.on(RTVIEvent.ServerMessage, (data: { type?: string; text?: string; code?: string; detail?: string; message?: string } & Partial<CorrectionEvent>) => {
        if (data?.type === "user_transcript" && data.text) opts.current.onHeard(data.text);
        else if (data?.type === "bot_transcript" && data.text) opts.current.onCoachLine(data.text);
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

  return { phase, state, muted, seconds, start, stop, toggleMute };
}
