"""Coach graph: load profile -> respond -> validate -> record."""
from pathlib import Path
from typing import TypedDict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from .levels import LEVEL_RULES
from pydantic import BaseModel

from .schemas import AgentTurn, Correction, Level, sanitize

PROMPTS = Path(__file__).parent.parent / "prompts"
PROMPT = (PROMPTS / "coach_system.md").read_text()
CORRECTOR_PROMPT = (PROMPTS / "corrector_system.md").read_text()
MAX_RETRIES = 1


class Reply(BaseModel):
    reply: str
    goal_covered: str | None = None


class Found(BaseModel):
    corrections: list[Correction] = []


class CoachState(TypedDict, total=False):
    level: Level
    scenario: dict
    history: list[BaseMessage]
    student_text: str
    system: str
    found: list[dict]
    turn: AgentTurn
    error: str
    retries: int


def next_step(scenario: dict, history: list[BaseMessage]) -> str:
    """The coach follows the scenario questions in order: the API asked question 0, so the next one follows the student's turns."""
    answered = sum(isinstance(m, HumanMessage) for m in history) + 1  # + the answer being processed
    questions = scenario["questions"]
    if answered < len(questions):
        return f'ask exactly this question next, nothing else: "{questions[answered]}"'
    return "the interview is over: thank the student briefly and close. Do not ask a new question."


def build_system_prompt(level: Level, scenario: dict, history: list[BaseMessage] | None = None) -> str:
    return PROMPT.format(
        next_step=next_step(scenario, history or []),
        coach_role=scenario["coach_role"],
        level=level,
        level_rules=LEVEL_RULES[level],
        questions=" | ".join(scenario["questions"]),
        goals=", ".join(scenario["goals"]),
        useful_words=", ".join(scenario["useful_words"]),
    )


def build_graph(llm: BaseChatModel):
    """load profile -> correct (strict, dedicated call) -> respond (coach) -> validate -> record."""
    corrector = llm.with_structured_output(Found.model_json_schema(), method="json_schema")
    coach = llm.with_structured_output(Reply.model_json_schema(), method="json_schema")

    def load_profile(state: CoachState) -> CoachState:
        return {"system": build_system_prompt(state["level"], state["scenario"], state.get("history", [])), "retries": 0}

    def correct(state: CoachState) -> CoachState:
        raw = corrector.invoke(
            [SystemMessage(CORRECTOR_PROMPT.format(level=state["level"])), HumanMessage(state["student_text"])]
        )
        found = raw.get("corrections") if isinstance(raw, dict) else []
        return {"found": found or []}

    def respond(state: CoachState) -> CoachState:
        messages = [SystemMessage(state["system"]), *state.get("history", []), HumanMessage(state["student_text"])]
        if state.get("error"):
            messages.append(SystemMessage(f"Your previous output was invalid: {state['error']}. Fix it."))
        raw = coach.invoke(messages)
        try:
            merged = {**raw, "corrections": state.get("found", []), "sentence_status": "green"}
            turn = AgentTurn.model_validate(sanitize(merged, state["scenario"]["goals"], state["student_text"]))
            return {"turn": turn, "error": ""}
        except ValidationError as e:
            return {"error": str(e), "retries": state.get("retries", 0) + 1}

    def route(state: CoachState) -> str:
        if not state.get("error"):
            return "record"
        return "respond" if state["retries"] <= MAX_RETRIES else END

    def record(state: CoachState) -> CoachState:
        history = [*state.get("history", []), HumanMessage(state["student_text"]), AIMessage(state["turn"].reply)]
        return {"history": history}

    g = StateGraph(CoachState)
    g.add_node("load_profile", load_profile)
    g.add_node("correct", correct)
    g.add_node("respond", respond)
    g.add_node("record", record)
    g.add_edge(START, "load_profile")
    g.add_edge("load_profile", "correct")
    g.add_edge("correct", "respond")
    g.add_conditional_edges("respond", route, {"record": "record", "respond": "respond", END: END})
    g.add_edge("record", END)
    return g.compile()
