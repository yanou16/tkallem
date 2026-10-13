""""Freeze meter": how long the student waits before starting to answer, the exact problem of the product made visible.

The app measures, for each answer, the seconds between the end of the coach's question and the first sound or the first
letter. The code (not the model) cleans it, averages it per session and compares sessions. A voice answer is told from a
typed one by `audio_seconds` (the same turn log), so each kind keeps its own wording and a voice session is never
compared with a typed one."""
import math

MAX_THINK_SECONDS = 120.0  # beyond this the student left the screen: a measure of that is not a freeze
MIN_ANSWERS = 1


def clean_think(value) -> float | None:
    """The measure as stored: a number between 0 and 120 seconds with one decimal, or None when it is not usable."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        return None
    return round(min(float(value), MAX_THINK_SECONDS), 1)


def freeze_summary(turns: list[dict]) -> dict | None:
    """From the session state's turns: {"seconds": average, "answers": n, "kind": "voice" | "text" | "mixed"}, or None
    when no answer has a measure (a session from before the freeze meter, or a client that did not send it)."""
    measured = [(t["think_seconds"], t.get("audio_seconds") is not None) for t in turns if clean_think(t.get("think_seconds")) is not None]
    if len(measured) < MIN_ANSWERS:
        return None
    voices = sum(v for _, v in measured)
    kind = "voice" if voices == len(measured) else "text" if voices == 0 else "mixed"
    return {"seconds": round(sum(s for s, _ in measured) / len(measured), 1), "answers": len(measured), "kind": kind}


def freeze_compare(now: dict | None, before: dict | None) -> dict | None:
    """What the report shows: this session's average and the previous one's, the latter only when they are comparable
    (same kind of answers, neither mixed)."""
    if now is None:
        return None
    comparable = before is not None and before["kind"] == now["kind"] and now["kind"] != "mixed"
    return {**now, "previous": before["seconds"] if comparable else None}
