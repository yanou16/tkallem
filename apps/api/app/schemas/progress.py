from pydantic import BaseModel


class ProgressMetrics(BaseModel):
    mistakes_per_100: float | None
    words_per_answer: float | None
    hesitations_per_min: float | None
    speaking_seconds: float | None


class TopMistake(BaseModel):
    id: str
    category: str
    original: str
    correction: str
    count: int


class Progress(BaseModel):
    current: ProgressMetrics
    baseline: ProgressMetrics | None
    mistakes_change: float | None
    top_mistakes: list[TopMistake]
    week_speaking_seconds: float
    today_speaking_seconds: float
    daily_goal_seconds: int
    streak_days: int