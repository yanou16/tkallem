"""Verdict: one line at the top of a finished session's report (ready / almost / not yet), in practice and in a real interview.

Computed by code from the report's own traffic lights (the thresholds of tkallem_agent.report), never by the model, and
never stored: it is derived from the stored metrics, so a report opened again later shows the same verdict.

It says whether the student is ready for THIS practice. It is not a promise about the real interview.
"""
from tkallem_agent.report import THRESHOLDS, level_of

MIN_ANSWERS = 3  # under three answers there is not enough to judge: no verdict, the report says so
METRICS = tuple(THRESHOLDS)  # mistakes_per_100, words_per_answer, hesitations_per_min (this order breaks ties)
_BADNESS = {"green": 0, "orange": 1, "red": 2}


def interview_verdict(metrics: dict, answers: int) -> dict | None:
    """{"status": "ready" | "almost" | "not_yet", "reasons": [{"metric", "level", "value"}, ...]} or None.

    - not_yet: a metric is red. ready: every available metric is green. almost: anything else.
    - reasons: the two weakest metrics (the two best when all are green), so the student reads why.
    - None: fewer than MIN_ANSWERS answers, or no mistake rate (nothing was said).
    A typed session has no hesitation measure: it is judged on the two others.
    """
    if answers < MIN_ANSWERS or metrics.get("mistakes_per_100") is None:
        return None
    scored = [
        {"metric": name, "level": level_of(name, metrics.get(name)), "value": metrics[name]}
        for name in METRICS
        if metrics.get(name) is not None
    ]
    levels = [m["level"] for m in scored]
    status = "not_yet" if "red" in levels else "ready" if all(level == "green" for level in levels) else "almost"
    ordered = sorted(scored, key=lambda m: -_BADNESS[m["level"]])  # stable: ties keep the METRICS order
    return {"status": status, "reasons": ordered[:2]}
