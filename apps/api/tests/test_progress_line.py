from app.progress_line import progress_line

NOW = {"speaking_seconds": 95.0, "mistakes_per_100": 4.2, "words_per_answer": 14.0, "hesitations_per_min": 2.0}


def test_first_interview_is_the_starting_point():
    assert progress_line(NOW, None) == "First interview done: this is your starting point."


def test_speaking_longer_comes_first():
    before = {**NOW, "speaking_seconds": 55.0, "mistakes_per_100": 9.0}
    assert progress_line(NOW, before) == "You spoke 40 seconds longer than last time."
    assert progress_line({**NOW, "speaking_seconds": 160.0}, before) == "You spoke 1 min 45 s longer than last time."


def test_fewer_mistakes_then_longer_answers_then_fewer_pauses():
    assert progress_line(NOW, {**NOW, "mistakes_per_100": 7.1}) == "Fewer mistakes than last time: 4.2 per 100 words, down from 7.1."
    assert progress_line(NOW, {**NOW, "words_per_answer": 9.4}) == "Longer answers than last time: 14 words each, up from 9."
    assert progress_line(NOW, {**NOW, "hesitations_per_min": 3.0}) == "Fewer pauses than last time: 2 per minute, down from 3."


def test_small_changes_and_worse_results_are_not_called_progress():
    before = {"speaking_seconds": 90.0, "mistakes_per_100": 4.0, "words_per_answer": 13.0, "hesitations_per_min": 1.8}
    assert progress_line(NOW, before, finished_before=2) == "Interview number 3 done. Every interview makes the next one easier."


def test_typed_sessions_have_no_speaking_time_or_pauses():
    now = {"speaking_seconds": None, "mistakes_per_100": 3.0, "words_per_answer": 10.0, "hesitations_per_min": None}
    before = {"speaking_seconds": 80.0, "mistakes_per_100": 5.0, "words_per_answer": 10.0, "hesitations_per_min": 2.0}
    assert progress_line(now, before) == "Fewer mistakes than last time: 3 per 100 words, down from 5."
