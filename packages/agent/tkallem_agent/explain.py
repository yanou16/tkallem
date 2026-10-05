"""Language of the explanation shown under each correction (student's choice, default French)."""

EXPLAIN = {
    "fr": {
        "why_rule": "one short, accurate sentence in French that names the real rule. No grammar jargon.",
        "examples": [
            ("I travel to Canada for work.", "for work", "to work", "Pour exprimer le but, on utilise to + verbe."),
            ("He is doctor.", "is doctor", "is a doctor", "Un métier prend l'article a."),
            ("We discussed about the plan.", "discussed about", "discussed", "Le verbe discuss ne prend pas de préposition."),
            ("My brothers likes football.", "brothers likes", "brothers like", "Sujet pluriel : le verbe n'a pas de -s."),
        ],
    },
    "en": {
        "why_rule": "one short, accurate sentence in SIMPLE English (max 15 words, only words a {level} learner knows) that names the real rule. No grammar jargon.",
        "examples": [
            ("I travel to Canada for work.", "for work", "to work", "To say why you do something, use to + verb."),
            ("He is doctor.", "is doctor", "is a doctor", "A job needs the word a before it."),
            ("We discussed about the plan.", "discussed about", "discussed", "The verb discuss does not need about."),
            ("My brothers likes football.", "brothers likes", "brothers like", "Many brothers: the verb has no -s."),
        ],
    },
}


def render(lang: str, level: str) -> dict[str, str]:
    cfg = EXPLAIN[lang]
    lines = [f'- "{s}" -> original "{o}", fixed "{f}", why "{w}"' for s, o, f, w in cfg["examples"]]
    return {"why_rule": cfg["why_rule"].format(level=level), "examples": "\n".join(lines)}
