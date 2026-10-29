from tkallem_agent import chat


def test_marks_without_color(monkeypatch):
    monkeypatch.setattr(chat, "USE_COLOR", False)
    before, after = chat.mark("I go to the US for study.", [{"original": "for study", "fixed": "to study"}])
    assert before == "I go to the US ~~for study~~." and after == "I go to the US **to study**."
    assert chat.metric_label("orange") == "to work on" and chat.status_label("orange", 2) == "2 fix(es)"
    assert chat.metric_label(None) == "n/a"


def test_list_scenarios(capsys):
    assert chat.main(["--list"]) == 0
    assert "visa-us" in capsys.readouterr().out


def test_openrouter_hosts_can_be_ignored_by_configuration(monkeypatch):
    from tkallem_agent import llm

    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    monkeypatch.setenv("OPENROUTER_PROVIDER_SORT", "latency")
    monkeypatch.setenv("OPENROUTER_PROVIDER_IGNORE", "GMICloud, Other")
    model = llm.get_llm("openrouter", "some/model")
    assert model.extra_body == {"provider": {"sort": "latency", "ignore": ["GMICloud", "Other"]}}
    monkeypatch.delenv("OPENROUTER_PROVIDER_IGNORE")
    assert llm.get_llm("openrouter", "some/model").extra_body == {"provider": {"sort": "latency"}}
