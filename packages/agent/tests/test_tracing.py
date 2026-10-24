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


def test_llm_reads_the_dotenv_of_the_working_directory(tmp_path, monkeypatch):
    import os

    from tkallem_agent import llm as llm_module

    (tmp_path / ".env").write_text("OPENROUTER_API_KEY=sk-or-from-dotenv\nLLM_MODEL=some/model\n")
    monkeypatch.setattr(os, "environ", os.environ.copy())  # whatever the loader sets is undone after the test
    os.environ.pop("OPENROUTER_API_KEY", None)
    os.environ.pop("LLM_MODEL", None)
    monkeypatch.chdir(tmp_path)
    llm_module._load_dotenv_once.cache_clear()
    model = llm_module.get_llm(provider="openrouter")
    assert model.model_name == "some/model"
    assert model.openai_api_key.get_secret_value() == "sk-or-from-dotenv"
    os.environ["OPENROUTER_API_KEY"] = "already-set"  # variables already set are never overridden
    llm_module._load_dotenv_once.cache_clear()
    assert llm_module.get_llm(provider="openrouter").openai_api_key.get_secret_value() == "already-set"
    llm_module._load_dotenv_once.cache_clear()


def test_openrouter_upstream_restriction_keeps_same_model_and_host_fallback(monkeypatch):
    from tkallem_agent.llm import get_llm
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_PROVIDER_SORT", "")
    monkeypatch.setenv("OPENROUTER_PROVIDER_ONLY", " deepinfra,parasail, ,venice ")
    model = get_llm(provider="openrouter", model="qwen/qwen3-235b-a22b-2507")
    assert model.model_name == "qwen/qwen3-235b-a22b-2507"
    assert model.extra_body == {"provider": {
        "only": ["deepinfra", "parasail", "venice"],
        "allow_fallbacks": True, "require_parameters": True,
    }}


def test_openrouter_routing_is_unchanged_without_restriction(monkeypatch):
    from tkallem_agent.llm import get_llm
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("OPENROUTER_PROVIDER_ONLY", raising=False)
    monkeypatch.setenv("OPENROUTER_PROVIDER_SORT", "latency")
    model = get_llm(provider="openrouter", model="qwen/qwen3-235b-a22b-2507")
    assert model.extra_body == {"provider": {"sort": "latency"}}
