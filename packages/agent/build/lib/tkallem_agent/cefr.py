"""CEFR level estimation (F10, Should): the estimator is pluggable. Any callable str -> level works
(e.g. the fine-tuned Hugging Face model). The estimate is always shown as "Estimated" and corrected by the student."""
import re
from collections.abc import Callable

ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
Estimator = Callable[[str], str]


def parse_level(text: str) -> str | None:
    m = re.search(r"\b(A1|A2|B1|B2|C1|C2)\b", text.upper())
    return m.group(1) if m else None


def clamp(level: str, lo: str = "A2", hi: str = "C1") -> str:
    """The product only supports A2 to C1 (F1): an A1 estimate shows as A2, a C2 estimate as C1."""
    return ORDER[min(max(ORDER.index(level), ORDER.index(lo)), ORDER.index(hi))]


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


def hf_space_estimator(space: str = "yanou16/cefr-english-classifier") -> Estimator:
    """Fine-tuned CEFR classifier (Qwen2.5-1.5B + QLoRA) served by its Hugging Face Space (needs `gradio_client`).
    The Space answers with Markdown such as "Intermediate (B1) - confidence 99.9%"."""
    from gradio_client import Client

    client = Client(space, verbose=False)

    def estimate(text: str) -> str:
        level = parse_level(str(client.predict(text, api_name="/run")))
        if level is None:
            raise ValueError("no CEFR level in the Space answer")
        return level

    return estimate
