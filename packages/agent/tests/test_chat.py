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
