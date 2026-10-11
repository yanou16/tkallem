from tkallem_agent.report import TurnRecord, build_report, compute_metrics, fallback_note, level_of
from tkallem_agent.schemas import Correction

C = Correction(original="for study", fixed="to study", type="grammar", why="Le but : to + verbe.")


class FakeLLM:
    def __init__(self, text):
        self.text = text

    def invoke(self, prompt, config=None):
        class R:
            content = self.text

        return R()


TURNS = [
    TurnRecord("I go to the US for study.", [C], "orange"),
    TurnRecord("I will study computer science at Georgia Tech.", [], "green"),
    TurnRecord("Uh I have scholarship um from DAAD.", [C, C, C], "red"),
]


def test_metrics_computed_by_code():
    m = compute_metrics(TURNS, speaking_seconds=60)
    assert m["words"] == 22 and m["words_per_answer"] == 7.3
    assert m["mistakes_per_100"] == round(4 / 22 * 100, 1)
    assert m["hesitations_per_min"] == 2.0  # uh, um
    assert compute_metrics(TURNS)["hesitations_per_min"] is None  # needs audio duration


def test_traffic_light_thresholds_from_spec():
    assert level_of("mistakes_per_100", 3.9) == "green" and level_of("mistakes_per_100", 8.1) == "red"
    assert level_of("mistakes_per_100", 5) == "orange"
    assert level_of("words_per_answer", 13) == "green" and level_of("words_per_answer", 5) == "red"
    assert level_of("hesitations_per_min", None) is None


def test_report_structure_and_redo_target():
    r = build_report(TURNS, FakeLLM("Good work. Practise verbs next."), "B1", coach_lines=["Q1", "Q2", "Q3"])
    assert [l["role"] for l in r.lines] == ["coach", "student"] * 3
    assert r.lines[r.redo_index]["status"] == "red"
    closing = build_report(TURNS, FakeLLM("ok"), "B1", coach_lines=["Q1", "Q2", "Q3", "Bye"])
    assert closing.lines[-1] == {"role": "coach", "text": "Bye", "status": None, "corrections": []}
    assert r.note == "Good work. Practise verbs next."


def test_note_with_invented_number_is_replaced_by_template():
    r = build_report(TURNS, FakeLLM("You are now B2 and made 99 mistakes."), "B1")
    assert "99" not in r.note and "B2" not in r.note
    assert r.note == fallback_note({"answers": 3, "clean_answers": 1, "answers_to_redo": 1, "most_frequent_mistake_types": ["grammar"]}, "fr")


def test_provider_error_still_gives_a_report():
    class Boom:
        def invoke(self, p, config=None):
            raise RuntimeError("provider down")

    assert build_report(TURNS, Boom(), "B1", "en").note.startswith("You answered 3 times")


def test_empty_session():
    r = build_report([], FakeLLM("x"), "B1")
    assert r.lines == [] and r.note == "" and r.redo_index is None


def test_redo_falls_back_to_the_most_corrected_orange_answer():
    turns = [
        TurnRecord("a b c", [C], "orange"),
        TurnRecord("d e f", [C, C], "orange"),
        TurnRecord("g h i", [], "green"),
    ]
    r = build_report(turns, FakeLLM("ok"), "B1")
    assert r.lines[r.redo_index]["text"] == "d e f"
    assert build_report([TurnRecord("ok fine", [], "green")], FakeLLM("ok"), "B1").redo_index is None


def test_long_pauses_count_as_hesitations():
    turns = [TurnRecord("I go to the US.", [], "green", pauses=2), TurnRecord("Um I think so.", [], "green", pauses=1)]
    m = compute_metrics(turns, speaking_seconds=60)
    assert m["hesitations_per_min"] == 4.0  # 1 filler ("Um") + 3 long pauses in one minute
    assert compute_metrics([TurnRecord("I go.", [], "green")], speaking_seconds=60)["hesitations_per_min"] == 0.0
