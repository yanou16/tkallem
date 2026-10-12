"""Monkeypatch for Pipecat SmallWebRTCConnection to fix connection & message deadlock.

Problem:
1. When a browser client establishes a WebRTC connection with SmallWebRTCTransport,
   the WebRTC SCTP data channel is opened while aiortc peer connection state
   is still reported as 'connecting' (ICE completed, but DTLS / transceiver state
   transitions lag slightly in aiortc).
2. The browser's RTVI client immediately dispatches 'client-ready' (an app-message)
   over the now-open data channel.
3. In Pipecat's SmallWebRTCConnection.on_message:
   It checks `self.is_connected()`. Because no 'ping' keep-alive message has arrived
   yet, `_last_received_time` is None, and `is_connected()` falls back to checking
   `self._pc.connectionState == 'connected'`, which is still False.
4. SmallWebRTCConnection logs:
   "Client not connected. Queuing app-message."
   and stores the message in `self._pending_app_messages`.
5. Crucially, Pipecat's SmallWebRTCConnection has no logic to flush `_pending_app_messages`
   when the peer connection state later transitions to 'connected', or when pings arrive.
   Furthermore, aiortc's `connectionstatechange` to 'connected' may never fire or be
   delayed, meaning:
   - `on_connected` handler is never called.
   - audio output track is never replaced in SmallWebRTCClient.
   - `ClientConnectedFrame` is never sent downstream.
   - RTVI never receives 'client-ready', so it never fires `on_client_ready`.
   - The bot never sends 'bot-ready' and never speaks.
   - The session hangs forever.

Solution:
1. Treat the connection as connected if `_connect_invoked` is True AND either:
   - The data channel is open (`readyState == 'open'`), OR
   - Any message/ping was received within the last 5 seconds, OR
   - ICE is completed/connected or pc is connected.
2. In `on_message`, update `_last_received_time` on ANY message (not only 'ping').
3. When `on_message` receives an app-message while `_connect_invoked` is True:
   - Trigger the 'connected' handler if not already triggered (so audio tracks are initialized).
   - Flush all previously queued pending app messages.
   - Deliver the current app message immediately.
4. Ensure 'connected' handler is triggered exactly once when the data channel opens
   or ICE completes.
"""
import asyncio
import json
import logging
import time
from typing import Any

from pipecat.transports.smallwebrtc.connection import SIGNALLING_TYPE, SmallWebRTCConnection

logger = logging.getLogger(__name__)

_PATCHED = False


def patch_smallwebrtc() -> None:
    global _PATCHED
    if _PATCHED:
        return
    _PATCHED = True

    orig_initialize = SmallWebRTCConnection._initialize
    orig_close = SmallWebRTCConnection._close

    def patched_initialize(self):
        orig_initialize(self)
        self._connected_event_fired = False

    async def patched_close(self):
        self._connected_event_fired = False
        await orig_close(self)

    def patched_is_connected(self) -> bool:
        if not getattr(self, "_connect_invoked", False):
            return False

        # If data channel is open, WebRTC transport is operational
        if getattr(self, "_data_channel", None) and self._data_channel.readyState == "open":
            return True

        # If we recently received any message or ping (within 5s)
        last_time = getattr(self, "_last_received_time", None)
        if last_time is not None and (time.time() - last_time) < 5.0:
            return True

        # Trust aiortc connection or ICE completion states
        if getattr(self, "_pc", None):
            if self._pc.connectionState == "connected":
                return True
            if getattr(self._pc, "iceConnectionState", None) in ("connected", "completed"):
                return True

        return False

    async def notify_connected_if_ready(self):
        if getattr(self, "_connect_invoked", False) and not getattr(self, "_connected_event_fired", False):
            if self.is_connected():
                self._connected_event_fired = True
                logger.info("SmallWebRTC connection active, triggering 'connected' event")
                await self._call_event_handler("connected")
                await flush_pending_app_messages(self)

    async def flush_pending_app_messages(self):
        while getattr(self, "_pending_app_messages", None):
            msg = self._pending_app_messages.pop(0)
            logger.debug("Flushing pending app-message: %s", msg)
            await self._call_event_handler("app-message", msg)

    async def patched_connect(self):
        self._connect_invoked = True
        if self.is_connected():
            await notify_connected_if_ready(self)
        await flush_pending_app_messages(self)

    async def patched_handle_new_connection_state(self):
        state = self._pc.connectionState
        if state == "connecting":
            self._monitoring_connecting_state()
        else:
            self._cancel_monitoring_connecting_state()

        if state == "connected" and not getattr(self, "_data_channel_timeout_task", None):
            self._start_data_channel_timeout()

        logger.debug(f"Connection state changed to: {state}")
        if state == "connected":
            await notify_connected_if_ready(self)
        elif state == "failed":
            logger.warning("Connection failed, closing peer connection.")
            await self._close()

    def patched_setup_listeners(self):
        self._connected_event_fired = False

        @self._pc.on("datachannel")
        def on_datachannel(channel):
            self._data_channel = channel

            if channel.readyState == "open":
                self._flush_message_queue()
                if getattr(self, "_connect_invoked", False):
                    asyncio.create_task(notify_connected_if_ready(self))

            @channel.on("open")
            async def on_open():
                logger.debug("Data channel is open!")
                self._flush_message_queue()
                if getattr(self, "_connect_invoked", False):
                    await notify_connected_if_ready(self)

            @channel.on("message")
            async def on_message(message):
                try:
                    self._last_received_time = time.time()
                    if isinstance(message, str) and message.startswith("ping"):
                        if getattr(self, "_connect_invoked", False):
                            await notify_connected_if_ready(self)
                    else:
                        json_message = json.loads(message)
                        if json_message.get("type") == SIGNALLING_TYPE and json_message.get("message"):
                            self._handle_signalling_message(json_message["message"])
                        else:
                            if getattr(self, "_connect_invoked", False):
                                await notify_connected_if_ready(self)
                                await flush_pending_app_messages(self)
                                await self._call_event_handler("app-message", json_message)
                            else:
                                logger.debug("Pipeline not connected yet. Queuing app-message.")
                                self._pending_app_messages.append(json_message)
                except Exception as e:
                    logger.error(f"Error parsing JSON message {message}, {e}")

        @self._pc.on("connectionstatechange")
        async def on_connectionstatechange():
            await self._handle_new_connection_state()

        @self._pc.on("iceconnectionstatechange")
        async def on_iceconnectionstatechange():
            logger.debug(
                f"ICE connection state is {self._pc.iceConnectionState}, connection is {self._pc.connectionState}"
            )
            if self._pc.iceConnectionState in ("connected", "completed"):
                if getattr(self, "_connect_invoked", False):
                    await notify_connected_if_ready(self)

        @self._pc.on("icegatheringstatechange")
        async def on_icegatheringstatechange():
            logger.debug(f"ICE gathering state is {self._pc.iceGatheringState}")

        @self._pc.on("track")
        async def on_track(track):
            logger.debug(f"Track {track.kind} received")
            await self._call_event_handler("track-started", track)

            @track.on("ended")
            async def on_ended():
                logger.debug(f"Track {track.kind} ended")
                await self._call_event_handler("track-ended", track)

    SmallWebRTCConnection._initialize = patched_initialize
    SmallWebRTCConnection._close = patched_close
    SmallWebRTCConnection.is_connected = patched_is_connected
    SmallWebRTCConnection.connect = patched_connect
    SmallWebRTCConnection._handle_new_connection_state = patched_handle_new_connection_state
    SmallWebRTCConnection._setup_listeners = patched_setup_listeners
    logger.info("SmallWebRTCConnection successfully patched.")


# Automatically apply patch on import
patch_smallwebrtc()
