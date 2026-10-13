"""The first line of the report (docs/JURY_BRIEF.md, improvement 4): progress before mistakes.

Written by code from the stored metrics, never by the model, so it is always true: the first real improvement on the
student's previous finished session, in this order: speaking longer, fewer mistakes per 100 words, longer answers,
fewer hesitations. With no previous session it is the starting point; with no improvement, the count of interviews."""

KEYS = ("speaking_seconds", "mistakes_per_100", "words_per_answer", "hesitations_per_min")


def _num(x) -> float | None:
    return float(x) if isinstance(x, (int, float)) else None


def _duration(seconds: float) -> str:
    s = round(seconds)
    return f"{s} seconds" if s < 60 else f"{s // 60} min {s % 60:02d} s"


def _one(x: float) -> str:
    return f"{x:.1f}".rstrip("0").rstrip(".")


def progress_line(now: dict, before: dict | None, finished_before: int = 0) -> str:
    """`now` and `before` hold the four metrics (None when not measured, e.g. hesitations in a typed session).
    `finished_before`: how many sessions the student finished before this one."""
    if before is None:
        return "First interview done: this is your starting point."
    n, b = ({k: _num(m.get(k)) for k in KEYS} for m in (now, before))
    if n["speaking_seconds"] is not None and b["speaking_seconds"] is not None and n["speaking_seconds"] - b["speaking_seconds"] >= 10:
        return f"You spoke {_duration(n['speaking_seconds'] - b['speaking_seconds'])} longer than last time."
    if n["mistakes_per_100"] is not None and b["mistakes_per_100"] is not None and b["mistakes_per_100"] - n["mistakes_per_100"] >= 0.5:
        return (f"Fewer mistakes than last time: {_one(n['mistakes_per_100'])} per 100 words, "
                f"down from {_one(b['mistakes_per_100'])}.")
    if n["words_per_answer"] is not None and b["words_per_answer"] is not None and n["words_per_answer"] - b["words_per_answer"] >= 2:
        return (f"Longer answers than last time: {round(n['words_per_answer'])} words each, "
                f"up from {round(b['words_per_answer'])}.")
    if n["hesitations_per_min"] is not None and b["hesitations_per_min"] is not None and b["hesitations_per_min"] - n["hesitations_per_min"] >= 0.5:
        return (f"Fewer pauses than last time: {_one(n['hesitations_per_min'])} per minute, "
                f"down from {_one(b['hesitations_per_min'])}.")
    total = finished_before + 1
    return f"Interview number {total} done. Every interview makes the next one easier."
