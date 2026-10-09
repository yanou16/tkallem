from pydantic import BaseModel


class DashboardData(BaseModel):
    speakingMinutesThisWeek: float
    streakDays: int
    mistakesPer100Words: float
    mistakesChange: float
    mistakesChangeLabel: str | None = None
    dailyGoalMinutes: int
    dailyCompletedMinutes: float


class TopMistake(BaseModel):
    id: str
    category: str
    original: str
    correction: str
    count: int


class ProgressMetrics(BaseModel):
    mistakes_per_100: float
    words_per_answer: float
    hesitations_per_min: float
    speaking_seconds: float


class ProgressData(BaseModel):
    current: ProgressMetrics
    baseline: ProgressMetrics | None = None
    top_mistakes: list[dict]
