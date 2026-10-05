from tkallem_agent import tracing


def test_tracing_off_without_keys(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    config = tracing.run_config("coach_turn", "s1", ["visa-us", "B1"])
    assert "callbacks" not in config
    assert config["metadata"] == {"langfuse_session_id": "s1", "langfuse_tags": ["visa-us", "B1"]}
    tracing.flush()  # no-op


def test_tracing_on_with_keys(monkeypatch):
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-lf-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-lf-test")
    monkeypatch.setenv("LANGFUSE_TRACING_ENABLED", "false")  # build the handler without sending anything
    config = tracing.run_config("coach_turn")
    assert len(config["callbacks"]) == 1
