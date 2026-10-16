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

IMPORTANT TIMING NOTE (the previous patch's root bug):
- SmallWebRTCClient.connect() (transport layer) checks is_connected() FIRST and returns
  early if True. This prevents webrtc_connection.connect() from being called.
- webrtc_connection.connect() is the ONLY place that sets _connect_invoked = True.
- If is_connected() returns True before _connect_invoked is set (because the data channel
  opened before the pipeline called connect()), the "connected" event NEVER fires.
- Fix: is_connected() MUST require _connect_invoked = True so the transport layer's
  early-return guard does NOT trigger before the pipeline explicitly calls connect().
- Once connect() IS called, we fire the "connected" event ourselves if the data channel
  is already open, flushing any pending app-messages (including "client-ready").

Solution:
1. is_connected() requires _connect_invoked = True (so transport layer doesn't skip connect()).
2. After _connect_invoked is set in connect(), immediately check if channel is already
   open and fire the "connected" event + flush pending messages.
3. When on_message receives any message while channel is open:
   - Update _last_received_time on ALL messages (not just pings).
   - After _connect_invoked is set: fire "connected" event if not yet fired, flush
     pending messages, deliver current message.
4. On data channel open: if _connect_invoked is already True, fire "connected" event.
5. On ICE connected/completed: same as data channel open.
"""
import asyncio
import json
import logging
import time

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
        self._connect_invoked = False

    async def patched_close(self):
        self._connected_event_fired = False
        self._connect_invoked = False
        await orig_close(self)

    def patched_is_connected(self) -> bool:
        """Connection is considered active only AFTER connect() has been called.

        This is critical: the transport-level SmallWebRTCClient.connect() checks
        is_connected() before calling webrtc_connection.connect(). If we return True
        here before _connect_invoked is set, the transport skips calling connect()
        entirely, the "connected" event never fires, and the session hangs.
        """
        if not getattr(self, "_connect_invoked", False):
            return False

        # Data channel is open → operational
        if getattr(self, "_data_channel", None) and self._data_channel.readyState == "open":
            return True

        # Recently received any message/ping (within 5s)
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

    async def _notify_connected_once(self):
        """Fire the 'connected' event exactly once and flush pending app-messages."""
        if getattr(self, "_connect_invoked", False) and not getattr(self, "_connected_event_fired", False):
            if self.is_connected():
                self._connected_event_fired = True
                logger.info("SmallWebRTC: data channel ready, firing 'connected' event")
                await self._call_event_handler("connected")
                await _flush_pending(self)

    async def _flush_pending(self):
        """Flush all queued app-messages through the 'app-message' handler."""
        while getattr(self, "_pending_app_messages", None):
            msg = self._pending_app_messages.pop(0)
            logger.debug("Flushing pending app-message: %s", msg)
            await self._call_event_handler("app-message", msg)

    async def patched_connect(self):
        """Set _connect_invoked and immediately fire 'connected' if data channel is ready."""
        self._connect_invoked = True
        logger.debug("SmallWebRTC: connect() called, _connect_invoked=True")
        # If data channel already open (race: browser was faster than pipeline startup),
        # fire the connected event right now so the transport can initialize audio tracks.
        await _notify_connected_once(self)

    async def patched_handle_new_connection_state(self):
        """Handle connection state changes, suppressing the original 'connected' event.

        The original fires self._call_event_handler('connected') when state becomes
        'connected'. We suppress that here because _notify_connected_once handles it
        with a one-time guard — preventing double-initialization of audio tracks.
        """
        state = self._pc.connectionState
        if state == "connecting":
            self._monitoring_connecting_state()
        else:
            self._cancel_monitoring_connecting_state()

        if state == "connected" and not getattr(self, "_data_channel_timeout_task", None):
            self._start_data_channel_timeout()

        logger.debug("Connection state changed to: %s", state)

        if state == "connected":
            # We do NOT fire the event here; _notify_connected_once handles it
            # with a one-time guard to prevent double-initialization of audio tracks.
            pass
        elif state == "failed":
            logger.warning("Connection failed, closing peer connection.")
            await self._close()
        else:
            await self._call_event_handler(state)

    def patched_setup_listeners(self):
        self._connected_event_fired = False

        @self._pc.on("datachannel")
        def on_datachannel(channel):
            self._data_channel = channel

            if channel.readyState == "open":
                self._flush_message_queue()
                if getattr(self, "_connect_invoked", False):
                    asyncio.create_task(_notify_connected_once(self))

            @channel.on("open")
            async def on_open():
                logger.debug("Data channel is open!")
                self._flush_message_queue()
                if getattr(self, "_connect_invoked", False):
                    await _notify_connected_once(self)

            @channel.on("message")
            async def on_message(message):
                try:
                    self._last_received_time = time.time()
                    if isinstance(message, str) and message.startswith("ping"):
                        # Ping: update keepalive time, try to fire connected event
                        if getattr(self, "_connect_invoked", False):
                            await _notify_connected_once(self)
                    else:
                        json_message = json.loads(message)
                        if json_message.get("type") == SIGNALLING_TYPE and json_message.get("message"):
                            self._handle_signalling_message(json_message["message"])
                        else:
                            if getattr(self, "_connect_invoked", False):
                                # Fire connected event if not yet fired
                                await _notify_connected_once(self)
                                # Flush any previously queued messages first
                                await _flush_pending(self)
                                # Deliver this message
                                await self._call_event_handler("app-message", json_message)
                            else:
                                logger.debug("Pipeline connect() not yet called. Queuing app-message: %s", json_message.get("type"))
                                self._pending_app_messages.append(json_message)
                except Exception as e:
                    logger.error("Error parsing JSON message %s: %s", message, e)

        @self._pc.on("connectionstatechange")
        async def on_connectionstatechange():
            await self._handle_new_connection_state()
            # After state change, try to fire the connected event if data channel is ready
            if self._pc.connectionState == "connected" and getattr(self, "_connect_invoked", False):
                await _notify_connected_once(self)

        @self._pc.on("iceconnectionstatechange")
        async def on_iceconnectionstatechange():
            logger.debug(
                "ICE connection state is %s, connection is %s",
                self._pc.iceConnectionState,
                self._pc.connectionState,
            )
            if self._pc.iceConnectionState in ("connected", "completed"):
                if getattr(self, "_connect_invoked", False):
                    await _notify_connected_once(self)

        @self._pc.on("icegatheringstatechange")
        async def on_icegatheringstatechange():
            logger.debug("ICE gathering state is %s", self._pc.iceGatheringState)

        @self._pc.on("track")
        async def on_track(track):
            logger.debug("Track %s received", track.kind)
            await self._call_event_handler("track-started", track)

            @track.on("ended")
            async def on_ended():
                logger.debug("Track %s ended", track.kind)
                await self._call_event_handler("track-ended", track)

    SmallWebRTCConnection._initialize = patched_initialize
    SmallWebRTCConnection._close = patched_close
    SmallWebRTCConnection.is_connected = patched_is_connected
    SmallWebRTCConnection.connect = patched_connect
    SmallWebRTCConnection._handle_new_connection_state = patched_handle_new_connection_state
    SmallWebRTCConnection._setup_listeners = patched_setup_listeners
    logger.info("SmallWebRTCConnection successfully patched (v2: timing-safe connected event).")


# Automatically apply patch on import
patch_smallwebrtc()
