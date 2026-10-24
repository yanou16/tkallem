import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parents[1] / "evals"))
import gate
from tkallem_agent.graph import Found
from tkallem_agent import llm


def test_preflight_accepts_structured_model_response(monkeypatch):
    model = MagicMock()
    model.with_structured_output.return_value.invoke.return_value = Found(corrections=[])
    monkeypatch.setattr(llm, "get_llm", lambda: model)
    assert gate.provider_preflight()
    model.with_structured_output.assert_called_once_with(Found, method="function_calling")


def test_routing_failure_fails_gate_before_running_quality_cases(monkeypatch, capsys):
    model = MagicMock()
    model.with_structured_output.return_value.invoke.side_effect = RuntimeError("No endpoints found that can handle the requested parameters")
    monkeypatch.setattr(llm, "get_llm", lambda: model)
    cases = MagicMock()
    monkeypatch.setattr(gate.run_evals, "evaluate", cases)
    assert gate.main() == 1
    cases.assert_not_called()
    assert "PROVIDER PREFLIGHT FAILED" in capsys.readouterr().out
