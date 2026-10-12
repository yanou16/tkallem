"""Tkallem coach agent. Public API: CoachSession (see session.py) and the scenario helpers."""
from .hints import Hint, HintError
from .repeat import RepeatResult, match_repeat
from .report import Report
from .scenarios import Scenario, ScenarioNotFound, list_scenarios, load_scenario
from .schemas import AgentTurn, Correction
from .session import AgentError, CoachSession

__all__ = [
    "AgentError",
    "AgentTurn",
    "CoachSession",
    "Correction",
    "Hint",
    "HintError",
    "RepeatResult",
    "Report",
    "Scenario",
    "ScenarioNotFound",
    "list_scenarios",
    "load_scenario",
    "match_repeat",
]
