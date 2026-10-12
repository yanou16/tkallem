import asyncio
import json
from unittest.mock import MagicMock

from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection

from app.voice import smallwebrtc_patch


def test_smallwebrtc_immediate_dispatch_when_data_channel_open(monkeypatch):
    """Verify that app-messages sent right after data channel opens are NOT queued indefinitely."""
    smallwebrtc_patch.patch_smallwebrtc()

    async def _test():
        conn = SmallWebRTCConnection()
        monkeypatch.setattr(type(conn._pc), "connectionState", property(lambda self: "connecting"))
        monkeypatch.setattr(type(conn._pc), "iceConnectionState", property(lambda self: "completed"))

        received_events = []

        @conn.event_handler("connected")
        async def on_connected(connection):
            received_events.append(("connected", connection))

        @conn.event_handler("app-message")
        async def on_app_message(connection, msg):
            received_events.append(("app-message", msg))

        # Pipeline started and invoked connect
        await conn.connect()
        assert conn._connect_invoked is True

        mock_channel = MagicMock()
        mock_channel.readyState = "open"
        channel_message_handler = None

        def mock_on(event_name):
            def decorator(handler):
                nonlocal channel_message_handler
                if event_name == "message":
                    channel_message_handler = handler
                return handler

            return decorator

        mock_channel.on = mock_on
        conn._pc.emit("datachannel", mock_channel)

        assert channel_message_handler is not None

        # Browser sends RTVI client-ready immediately before any ping
        client_ready_msg = json.dumps({"type": "client-ready", "version": "1.0"})
        await channel_message_handler(client_ready_msg)

        # Allow async event handler tasks to finish
        await asyncio.sleep(0.05)

        # Both "connected" and "app-message" must have been fired
        event_names = [e[0] for e in received_events]
        assert "connected" in event_names
        assert "app-message" in event_names
        assert len(conn._pending_app_messages) == 0
        assert received_events[-1][1] == {"type": "client-ready", "version": "1.0"}

    asyncio.run(_test())


def test_smallwebrtc_queued_messages_flushed_on_connect(monkeypatch):
    """Verify that messages arriving before pipeline connect() are flushed when connect() runs."""
    smallwebrtc_patch.patch_smallwebrtc()

    async def _test():
        conn = SmallWebRTCConnection()
        monkeypatch.setattr(type(conn._pc), "connectionState", property(lambda self: "connecting"))

        received_events = []

        @conn.event_handler("connected")
        async def on_connected(connection):
            received_events.append(("connected", connection))

        @conn.event_handler("app-message")
        async def on_app_message(connection, msg):
            received_events.append(("app-message", msg))

        mock_channel = MagicMock()
        mock_channel.readyState = "open"
        channel_message_handler = None

        def mock_on(event_name):
            def decorator(handler):
                nonlocal channel_message_handler
                if event_name == "message":
                    channel_message_handler = handler
                return handler

            return decorator

        mock_channel.on = mock_on
        conn._pc.emit("datachannel", mock_channel)

        # Message arrives before conn.connect() is invoked
        early_msg = json.dumps({"type": "early-handshake"})
        await channel_message_handler(early_msg)

        await asyncio.sleep(0.05)

        # Should be queued in _pending_app_messages
        assert len(conn._pending_app_messages) == 1
        assert len(received_events) == 0

        # Now pipeline connects
        await conn.connect()

        await asyncio.sleep(0.05)

        # Queued message must be flushed
        event_names = [e[0] for e in received_events]
        assert "connected" in event_names
        assert "app-message" in event_names
        assert len(conn._pending_app_messages) == 0
        assert received_events[-1][1] == {"type": "early-handshake"}

    asyncio.run(_test())
