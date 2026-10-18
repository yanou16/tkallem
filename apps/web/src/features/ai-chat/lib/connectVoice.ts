import type { SmallWebRTCTransportConnectionOptions } from "@pipecat-ai/small-webrtc-transport";
import { API_URL } from "@/lib/config";
import { ApiError, getAuthHeaderValue } from "@/lib/api/client";

type VoiceClient = {
  initDevices(): Promise<void>;
  connect(params: SmallWebRTCTransportConnectionOptions): Promise<unknown>;
};

/** Microphone permission can outlive Clerk's short-lived JWT. Authenticate only after devices are ready. */
export async function connectVoice(client: VoiceClient, sessionId: string) {
  await client.initDevices();
  const authorization = await getAuthHeaderValue(undefined, true);
  if (!authorization) throw new ApiError("Your session is not ready. Sign in again or reload before starting a call.", 401);
  try {
    return await client.connect({
      webrtcRequestParams: {
        endpoint: `${API_URL}/sessions/${encodeURIComponent(sessionId)}/webrtc`,
        headers: new Headers({ Authorization: authorization }),
        timeout: 30_000,
      },
    });
  } catch (error) {
    const failure = error as { status?: number; cause?: { status?: number } };
    if (failure?.status === 401 || failure?.cause?.status === 401) {
      throw new ApiError("The voice server rejected your login. Reload the page or sign in again, then retry the call.", 401);
    }
    throw error;
  }
}
