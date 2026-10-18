"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { connectVoice } from "../lib/connectVoice";
import type { CoachState } from "../components/VoiceState";

export type RealtimeVoiceOptions = {
  sessionId: string | undefined;
  onUserTranscript?: (text: string) => void;
  onBotTranscript?: (text: string) => void;
  onCorrection?: (data: {
    utterance_id: string;
    original: string;
    reply: string;
    corrections: any[];
    sentence_status: "green" | "orange" | "red";
    timestamp: number;
  }) => void;
  onError?: (error: Error) => void;
};

export function useRealtimeVoice({
  sessionId,
  onUserTranscript,
  onBotTranscript,
  onCorrection,
  onError,
}: RealtimeVoiceOptions) {
  const [state, setState] = useState<CoachState>("idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const [isAgentReady, setIsAgentReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const clientRef = useRef<PipecatClient | null>(null);
  const connectedAt = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(async () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
    if (clientRef.current) {
      try {
        await clientRef.current.disconnect();
      } catch (err) {
        console.warn("Error disconnecting Pipecat client:", err);
      }
      clientRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsWebRTCConnected(false);
    setIsAgentReady(false);
    setIsMuted(false);
    setAudioLevel(0);
    connectedAt.current = null;
    setDuration(0);
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (!sessionId) return;
    if (clientRef.current) {
      await stop();
    }

    try {
      setIsConnecting(true);
      setIsWebRTCConnected(false);
      setIsAgentReady(false);

      // Initialize audio element during user gesture
      if (typeof document !== "undefined") {
        if (!audioElementRef.current) {
          const el = document.createElement("audio");
          el.autoplay = true;
          (el as any).playsInline = true;
          document.body.appendChild(el);
          audioElementRef.current = el;
        }
      }

      const transport = new SmallWebRTCTransport();

      const client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
      });

      const playTrack = (track: MediaStreamTrack) => {
        try {
          if (!audioElementRef.current && typeof document !== "undefined") {
            const el = document.createElement("audio");
            el.autoplay = true;
            (el as any).playsInline = true;
            document.body.appendChild(el);
            audioElementRef.current = el;
          }
          if (audioElementRef.current) {
            audioElementRef.current.srcObject = new MediaStream([track]);
            audioElementRef.current.play().catch((err) => {
              console.warn("[RealtimeVoice] Audio playback error:", err);
            });
          }
        } catch (e) {
          console.warn("[RealtimeVoice] Failed to attach audio track:", e);
        }
      };

      const checkBotTracks = () => {
        try {
          const botAudioTrack = client.tracks()?.bot?.audio;
          if (botAudioTrack) {
            playTrack(botAudioTrack);
          }
        } catch {}
      };

      client.on(RTVIEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
        setIsWebRTCConnected(true);
        connectedAt.current = performance.now();
        setDuration(0);
        setState("idle");
        checkBotTracks();
      });

      client.on(RTVIEvent.BotReady, () => {
        setIsAgentReady(true);
        setIsConnected(true);
        setIsConnecting(false);
        checkBotTracks();
      });

      client.on(RTVIEvent.TrackStarted, (track: MediaStreamTrack, participant?: any) => {
        if (participant?.local || track.kind !== "audio") return;
        playTrack(track);
      });

      client.on(RTVIEvent.TrackStopped, (track: MediaStreamTrack, participant?: any) => {
        if (!participant?.local && track.kind === "audio" && audioElementRef.current) {
          audioElementRef.current.srcObject = null;
        }
      });

      client.on(RTVIEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsWebRTCConnected(false);
        setIsAgentReady(false);
        setIsMuted(false);
        setAudioLevel(0);
        connectedAt.current = null;
        setDuration(0);
        setState("idle");
      });

      client.on(RTVIEvent.LocalAudioLevel, (level: number) => {
        setAudioLevel(Math.max(0, Math.min(1, level)));
      });

      client.on(RTVIEvent.UserStartedSpeaking, () => {
        setState("listening");
      });

      client.on(RTVIEvent.UserStoppedSpeaking, () => {
        setState("thinking");
      });

      client.on(RTVIEvent.BotStartedSpeaking, () => {
        setState("speaking");
      });

      client.on(RTVIEvent.BotStoppedSpeaking, () => {
        setState("idle");
      });

      client.on(RTVIEvent.UserTranscript, (data: any) => {
        const text = typeof data === "string" ? data : data?.text;
        if (text && onUserTranscript) {
          onUserTranscript(text);
        }
      });

      client.on(RTVIEvent.BotTranscript, (data: any) => {
        const text = typeof data === "string" ? data : data?.text;
        if (text && onBotTranscript) {
          onBotTranscript(text);
        }
      });

      client.on(RTVIEvent.ServerMessage, (data: any) => {
        if (data?.type === "user_transcript" && onUserTranscript) {
          onUserTranscript(data.text);
        } else if (data?.type === "correction" && onCorrection) {
          onCorrection(data);
        } else if (data?.type === "error") {
          const detail = data.detail ?? data.message ?? data.code ?? "The live voice session failed.";
          onError?.(new Error(String(detail)));
        } else if (data?.type === "bot_transcript" && onBotTranscript) {
          onBotTranscript(data.text);
        }
      });

      client.on(RTVIEvent.Error, (err: any) => {
        console.error("RTVI error:", err);
        const error = err instanceof Error ? err : new Error(String(err?.message ?? err));
        onError?.(error);
      });

      // Assign ref BEFORE connect() so RTVI event handlers fire correctly
      // and cleanup in catch() can call disconnect().
      clientRef.current = client;
      await connectVoice(client, sessionId);
    } catch (err) {
      if (clientRef.current) {
        clientRef.current.disconnect().catch(() => {});
        clientRef.current = null;
      }
      setIsConnecting(false);
      setIsConnected(false);
      setIsWebRTCConnected(false);
      setIsAgentReady(false);
      setState("idle");
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      throw error;
    }
  }, [sessionId, onUserTranscript, onBotTranscript, onCorrection, onError, stop]);

  const toggleMute = useCallback(() => {
    if (!clientRef.current) return;
    const nextMuted = !isMuted;
    clientRef.current.enableMic(!nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  useEffect(() => {
    if (!isConnected) return;
    const timer = window.setInterval(() => {
      if (connectedAt.current !== null) {
        setDuration((performance.now() - connectedAt.current) / 1000);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [isConnected]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect().catch(() => {});
        clientRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isConnected,
    isConnecting,
    isWebRTCConnected,
    isAgentReady,
    isMuted,
    audioLevel,
    duration,
    start,
    stop,
    toggleMute,
  };
}
