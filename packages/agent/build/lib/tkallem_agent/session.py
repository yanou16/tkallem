"""CoachSession: the one object the API needs to run a practice session.

    session = CoachSession("visa-us", level="B1", explain_lang="fr")
    session.opening                        # first coach line (question 0, or the free-talk opener)
    turn = session.turn("I go to the US for study.", audio_seconds=3.2)   # -> AgentTurn (contract)
    for event in session.turn_events("..."): ...   # same turn, coach reply first (start the voice early)
    report = session.end()                 # -> Report (transcript, metrics, colors, honest note)

    saved = session.to_state()             # JSON-able, store it between HTTP requests
    session = CoachSession.from_state(saved)

Errors: ValueError for bad input (empty or too long answer, unknown level), ScenarioNotFound for an unknown
scenario, AgentError when the LLM provider fails or returns an unusable output twice (the API can answer 502
and the student can retry the same answer).
"""
import asyncio
import os
import time
import uuid
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from .graph import build_graph, compose_reply, final_corrections
from .levels import MAX_WORDS
from .llm import default_llm
from .report import Report, TurnRecord, build_report
from .scenarios import Scenario, load_scenario
from .schemas import AgentTurn, Correction, ExplainLang, Level
from .tracing import run_config

MAX_TEXT_CHARS = int(os.getenv("TKALLEM_MAX_TEXT_CHARS", "1000"))
STATE_VERSION = 1
_graphs: dict[int, tuple[BaseChatModel, object]] = {}  # one compiled graph per LLM client


class AgentError(RuntimeError):
    """The agent could not produce a valid turn or report (provider error, or invalid output after retry)."""


@dataclass
class TurnLog:
    """What is kept for each student turn (text only, never audio)."""

    student_text: str
    reply: str
    corrections: list[dict]
    status: str
    goal_covered: str | None = None
    audio_seconds: float | None = None
    timings: dict = field(default_factory=dict)


def _graph_for(llm: BaseChatModel):
    key = id(llm)
    if key not in _graphs:
        _graphs[key] = (llm, build_graph(llm))
    return _graphs[key][1]


class CoachSession:
    def __init__(
        self,
        scenario: Scenario | str,
        level: Level,
        explain_lang: ExplainLang = "fr",
        *,
        llm: BaseChatModel | None = None,
        session_id: str | None = None,
    ):
        if level not in MAX_WORDS:
            raise ValueError(f"unknown level {level!r}: expected one of {list(MAX_WORDS)}")
        if explain_lang not in ("en", "fr"):
            raise ValueError(f"unknown explanation language {explain_lang!r}: expected 'en' or 'fr'")
        self.scenario = load_scenario(scenario) if isinstance(scenario, str) else scenario
        self.level: Level = level
        self.explain_lang: ExplainLang = explain_lang
        self.session_id = session_id or uuid.uuid4().hex
        self.turns: list[TurnLog] = []
        self.last_timings: dict[str, float] = {}
        self._llm = llm

    @property
    def llm(self) -> BaseChatModel:
        return self._llm or default_llm()

    @property
    def opening(self) -> str:
        return self.scenario.first_line

    @property
    def finished(self) -> bool:
        """Guided scenario: every question has been answered. Free talk never finishes by itself."""
        return self.scenario.mode == "guided" and len(self.turns) >= len(self.scenario.questions)

    def history(self) -> list[BaseMessage]:
        messages: list[BaseMessage] = [AIMessage(self.opening)]
        for t in self.turns:
            messages += [HumanMessage(t.student_text), AIMessage(t.reply)]
        return messages

    def _tracing(self, run_name: str) -> dict:
        return run_config(run_name, self.session_id, [self.scenario.id, self.level, self.explain_lang])

    def _clean_input(self, student_text: str, audio_seconds: float | None) -> str:
        text = " ".join(str(student_text).split())
        if not text:
            raise ValueError("empty answer")
        if len(text) > MAX_TEXT_CHARS:
            raise ValueError(f"answer too long ({len(text)} characters, max {MAX_TEXT_CHARS})")
        if audio_seconds is not None and audio_seconds < 0:
            raise ValueError("audio_seconds must be positive")
        return text

    def turn_events(self, student_text: str, audio_seconds: float | None = None) -> Iterator[dict]:
        """Same as turn(), but yields each part as soon as it is ready, so the app can start the coach's voice
        before the corrections are done (DESIGN.md: corrections animate in after the coach reply starts).

        Events, "reply" and "corrections" in either order, "done" always last:
            {"type": "reply", "reply": str}
            {"type": "corrections", "corrections": [Correction as dict], "sentence_status": "green|orange|red"}
            {"type": "done", "turn": AgentTurn, "timings": {seconds}}
        Raises AgentError (possibly after a "corrections" event); the turn is then not recorded.
        """
        text = self._clean_input(student_text, audio_seconds)
        scenario, history = self.scenario.model_dump(), self.history()
        state = {
            "level": self.level,
            "explain_lang": self.explain_lang,
            "scenario": scenario,
            "history": history,
            "student_text": text,
        }
        t0 = time.perf_counter()
        timings: dict[str, float] = {}
        turn, error = None, None
        updates = _graph_for(self.llm).stream(state, config=self._tracing("coach_turn"), stream_mode="updates")
        while True:
            try:
                update = next(updates)
            except StopIteration:
                break
            except Exception as e:  # provider down, timeout, bad credentials...
                raise AgentError(f"agent call failed: {type(e).__name__}: {e}") from e
            for node, data in update.items():
                if not data:
                    continue
                timings.update(data.get("timings", {}))
                if node == "coach" and data.get("reply") is not None:
                    timings["reply_ready"] = time.perf_counter() - t0
                    yield {"type": "reply", "reply": compose_reply(data["reply"], scenario, history)}
                elif node == "correct":
                    corrections, status = final_corrections(data.get("found", []), scenario, text)
                    yield {"type": "corrections", "corrections": corrections, "sentence_status": status}
                elif node == "assemble":
                    turn, error = data.get("turn"), data.get("error")
        if turn is None:
            raise AgentError(f"invalid agent output after retry: {error}")

        timings["total"] = time.perf_counter() - t0
        self.turns.append(
            TurnLog(
                student_text=text,
                reply=turn.reply,
                corrections=[c.model_dump() for c in turn.corrections],
                status=turn.sentence_status,
                goal_covered=turn.goal_covered,
                audio_seconds=audio_seconds,
                timings=timings,
            )
        )
        self.last_timings = timings
        yield {"type": "done", "turn": turn, "timings": timings}

    def turn(self, student_text: str, audio_seconds: float | None = None) -> AgentTurn:
        """One student answer in, the full coach turn out (reply + corrections + status), as in the contract."""
        for event in self.turn_events(student_text, audio_seconds):
            if event["type"] == "done":
                return event["turn"]
        raise AgentError("no turn produced")  # unreachable: turn_events ends with "done" or raises

    def speaking_seconds(self) -> float | None:
        """Only when every answer was spoken: mixing typed and spoken answers would distort hesitations per minute."""
        if not self.turns or any(t.audio_seconds is None for t in self.turns):
            return None
        return round(sum(t.audio_seconds for t in self.turns), 1)  # type: ignore[misc]

    def end(self) -> Report:
        records = [TurnRecord(t.student_text, [Correction(**c) for c in t.corrections], t.status) for t in self.turns]  # type: ignore[arg-type]
        coach_lines = [self.opening] + [t.reply for t in self.turns]
        t0 = time.perf_counter()
        report = build_report(
            records,
            self.llm,
            self.level,
            self.explain_lang,
            speaking_seconds=self.speaking_seconds(),
            coach_lines=coach_lines,
            config=self._tracing("session_report"),
        )
        self.last_timings = {"report": time.perf_counter() - t0}
        return report

    async def aturn(self, student_text: str, audio_seconds: float | None = None) -> AgentTurn:
        """Async wrapper for FastAPI: runs the blocking LLM calls in a worker thread."""
        return await asyncio.to_thread(self.turn, student_text, audio_seconds)

    async def aend(self) -> Report:
        return await asyncio.to_thread(self.end)

    def to_state(self) -> dict:
        return {
            "version": STATE_VERSION,
            "session_id": self.session_id,
            "scenario_id": self.scenario.id,
            "level": self.level,
            "explain_lang": self.explain_lang,
            "turns": [asdict(t) for t in self.turns],
        }

    @classmethod
    def from_state(cls, state: dict, *, llm: BaseChatModel | None = None) -> "CoachSession":
        if state.get("version") != STATE_VERSION:
            raise ValueError(f"unsupported session state version: {state.get('version')!r}")
        session = cls(state["scenario_id"], state["level"], state["explain_lang"], llm=llm, session_id=state["session_id"])
        session.turns = [TurnLog(**t) for t in state["turns"]]
        return session
