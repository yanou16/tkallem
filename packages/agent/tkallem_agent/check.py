"""Private check of a written text (practice groups): the corrector of a coach turn, applied to a text alone.

Same prompt, same output schema, same retry and same code guardrails (schemas.sanitize) as the `correct` node of
graph.py: only the call is rebuilt here, because that node lives inside build_graph. No coach, no scenario, nothing
stored. Import it with `from tkallem_agent.check import check_text`.
"""
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig

from .explain import render
from .graph import (
    CORRECTOR_PROMPT,
    MAX_RETRIES,
    RETRY_COMPACT,
    STRUCTURED_METHOD,
    Found,
    final_corrections,
    hedged_invoke,
    learner_text,
)
from .levels import MAX_WORDS
from .llm import default_llm
from .schemas import Correction, ExplainLang, Level
from .session import MAX_TEXT_CHARS, AgentError


def check_text(
    text: str,
    level: Level,
    explain_lang: ExplainLang = "fr",
    *,
    llm: BaseChatModel | None = None,
    max_text_chars: int = MAX_TEXT_CHARS,
    config: RunnableConfig | None = None,
) -> list[Correction]:
    """The corrections of a student's text (at most 3, `rule` filled when the model gives a known one).

    ValueError: empty or too long text, unknown level or explanation language (no call to the model).
    AgentError: the model is not configured, the provider fails, or the output is unusable twice.
    """
    if level not in MAX_WORDS:
        raise ValueError(f"unknown level {level!r}: expected one of {list(MAX_WORDS)}")
    if explain_lang not in ("en", "fr"):
        raise ValueError(f"unknown explanation language {explain_lang!r}: expected 'en' or 'fr'")
    text = " ".join(str(text).split())  # same cleaning as an answer (CoachSession._clean_input)
    if not text:
        raise ValueError("empty text")
    if len(text) > max_text_chars:
        raise ValueError(f"text too long ({len(text)} characters, max {max_text_chars})")

    if llm is None:
        try:
            llm = default_llm()
        except (KeyError, ValueError) as e:  # missing API key, unknown provider: a configuration problem
            raise AgentError(f"LLM is not configured ({type(e).__name__}: {e})") from e

    # The call of graph.correct: corrector prompt, learner text framed as data, one compact retry.
    corrector = llm.with_structured_output(Found.model_json_schema(), method=STRUCTURED_METHOD)
    system = CORRECTOR_PROMPT.format(level=level, **render(explain_lang, level))
    messages = [SystemMessage(system), HumanMessage(learner_text(text))]
    for attempt in range(MAX_RETRIES + 1):
        try:
            raw = hedged_invoke(corrector, messages, config)
            break
        except Exception as e:  # unparseable or runaway output, provider error: one more try, then it fails
            if attempt == MAX_RETRIES:
                raise AgentError(f"corrector failed: {type(e).__name__}: {e}") from e
            messages = [*messages, SystemMessage(RETRY_COMPACT)]

    found = raw.get("corrections") if isinstance(raw, dict) else None
    meaning = bool(raw.get("changes_meaning")) if isinstance(raw, dict) else False
    # No scenario: no goal ids to check. The praise and priority_index the corrector also gives are not used here.
    kept = final_corrections(found or [], {}, text, meaning)["corrections"]
    return [Correction.model_validate(c) for c in kept]
