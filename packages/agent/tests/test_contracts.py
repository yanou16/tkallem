"""The code must match packages/contracts (the shared contract between the three owners)."""
import json
from pathlib import Path

import jsonschema
import pytest
import yaml

from tkallem_agent.testing import FakeChat
from tkallem_agent import CoachSession
from tkallem_agent.schemas import RULES, AgentTurn

CONTRACTS = Path(__file__).parents[2] / "contracts"
AGENT_SCHEMA = json.loads((CONTRACTS / "agent_turn.schema.json").read_text())
OPENAPI = yaml.safe_load((CONTRACTS / "openapi.yaml").read_text())
PENDING = "why_fr" in json.dumps(AGENT_SCHEMA)  # contract PR #3 (why_fr -> why) not merged yet

TURN = AgentTurn(
    reply="Good. How will you pay for your studies?",
    corrections=[{"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe.", "rule": "verb_pattern"}],
    sentence_status="orange",
    goal_covered="purpose_of_trip",
)


@pytest.mark.skipif(PENDING, reason="contract still says why_fr: merge contract PR #3 (explain_lang)")
def test_agent_turn_matches_the_agent_contract():
    jsonschema.validate(TURN.model_dump(), AGENT_SCHEMA)


@pytest.mark.skipif(PENDING, reason="contract still says why_fr: merge contract PR #3 (explain_lang)")
def test_correction_fields_match_the_api_contract():
    contract = OPENAPI["components"]["schemas"]["Correction"]
    fields = set(TURN.corrections[0].model_dump())
    assert set(contract["properties"]) == fields
    assert set(contract["required"]) == fields - {"rule"}  # rule is optional
    assert set(contract["properties"]["rule"]["enum"]) - {None} == set(RULES)


def test_status_and_types_match_the_contracts():
    statuses = OPENAPI["components"]["schemas"]["SentenceStatus"]["enum"]
    assert set(statuses) == {"green", "orange", "red"}
    types = AGENT_SCHEMA["properties"]["corrections"]["items"]["properties"]["type"]["enum"]
    assert set(types) == {"grammar", "vocabulary", "word_choice", "other"}
    assert AGENT_SCHEMA["properties"]["corrections"]["maxItems"] == 3


def test_report_has_the_fields_of_the_end_endpoint():
    end = OPENAPI["paths"]["/sessions/{id}/end"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
    s = CoachSession("visa-us", "B1", llm=FakeChat([{"corrections": []}], [{"reaction": "Good.", "goal_covered": None}], text=["ok"]))
    s.turn("To study.")
    report = s.end().model_dump()
    assert set(end["required"]) <= report.keys()
    line_fields = set(end["properties"]["lines"]["items"]["properties"])
    assert all(line_fields <= line.keys() for line in report["lines"])
    metric_fields = {"mistakes_per_100", "words_per_answer", "hesitations_per_min", "speaking_seconds"}
    assert metric_fields <= report["metrics"].keys()


def test_rule_values_match_both_contracts():
    in_schema = AGENT_SCHEMA["properties"]["corrections"]["items"]["properties"]["rule"]["enum"]
    assert set(in_schema) - {None} == set(RULES)
