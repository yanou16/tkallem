"""CEFR level estimation (F10, Should): the estimator is pluggable. Any callable str -> level works
(e.g. the fine-tuned Hugging Face model). The estimate is always shown as "Estimated" and corrected by the student."""
import re
from collections.abc import Callable

ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
Estimator = Callable[[str], str]


def parse_level(text: str) -> str | None:
    m = re.search(r"\b(A1|A2|B1|B2|C1|C2)\b", text.upper())
    return m.group(1) if m else None


def distance(a: str, b: str) -> int:
    return abs(ORDER.index(a) - ORDER.index(b))


PROMPT = """You are an examiner. Estimate the CEFR level (A1, A2, B1, B2, C1 or C2) of the speaker from this transcript of spoken English.
Judge grammar range and accuracy, vocabulary range, and complexity of sentences. Answer with ONLY the level, nothing else.

Transcript:
{text}"""


def llm_estimator(llm) -> Estimator:
    """Zero-shot baseline with a general LLM, to compare against the fine-tuned model."""

    def estimate(text: str) -> str:
        level = parse_level(str(llm.invoke(PROMPT.format(text=text)).content))
        if level is None:
            raise ValueError("no CEFR level in the model answer")
        return level

    return estimate
