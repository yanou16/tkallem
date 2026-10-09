from enum import Enum


class Level(str, Enum):
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"


class ExplainLang(str, Enum):
    EN = "en"
    FR = "fr"


class PracticeMode(str, Enum):
    TEXT = "text"
    VOICE = "voice"


class SentenceStatus(str, Enum):
    GREEN = "green"
    ORANGE = "orange"
    RED = "red"


class CorrectionType(str, Enum):
    GRAMMAR = "grammar"
    VOCABULARY = "vocabulary"
    WORD_CHOICE = "word_choice"
    OTHER = "other"


class ScenarioCategory(str, Enum):
    SPEAKING = "speaking"
    VOCABULARY = "vocabulary"
    GRAMMAR = "grammar"
    EXAMS = "exams"
    WORK = "work"
    TRAVEL = "travel"
