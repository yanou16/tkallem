"""Level rules injected into the prompts. The declared level drives everything."""

# Longest sentence the coach may say, per level. Also checked by code after each reply (see graph.reaction_problem).
MAX_WORDS = {"A2": 8, "B1": 12, "B2": 18, "C1": 25}

LEVEL_RULES = {
    "A2": f"Use very short sentences (max {MAX_WORDS['A2']} words), the 500 most common English words, present and simple past only. One idea per sentence.",
    "B1": f"Use short sentences (max {MAX_WORDS['B1']} words), everyday vocabulary, simple tenses. Avoid idioms and phrasal verbs unless very common.",
    "B2": f"Use clear sentences (max {MAX_WORDS['B2']} words), a wider vocabulary, some phrasal verbs. Avoid rare idioms.",
    "C1": f"Speak naturally with varied structures and vocabulary (max {MAX_WORDS['C1']} words per sentence), but stay clear and never use obscure words.",
}
