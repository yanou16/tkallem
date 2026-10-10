"""Language of the explanation shown under each correction (student's choice, default French)."""

EXPLAIN = {
    "fr": {
        "why_rule": "one short, accurate sentence in French that names the real rule. No grammar jargon.",
        "examples": [
            ("I travel to Canada for work.", "for work", "to work", "Pour exprimer le but, on utilise to + verbe.", "verb_pattern"),
            ("He is doctor.", "is doctor", "is a doctor", "Un métier prend l'article a.", "article"),
            ("We discussed about the plan.", "discussed about", "discussed", "Le verbe discuss ne prend pas de préposition.", "preposition"),
            ("My brothers likes football.", "brothers likes", "brothers like", "Sujet pluriel : le verbe n'a pas de -s.", "subject_verb_agreement"),
            ("She lives in Oran since three years.", "lives in Oran since three years", "has lived in Oran for three years", "Action qui dure jusqu'à maintenant : present perfect + for avec une durée.", "verb_tense"),
            ("The advices are useful.", "advices are", "advice is", "Advice est indénombrable : pas de -s, verbe au singulier.", "plural_uncountable"),
            ("Does he can swim?", "Does he can", "Can he", "Avec can, on fait la question sans do.", "other"),
        ],
    },
    "en": {
        "why_rule": "one short, accurate sentence in SIMPLE English (max 15 words, only words a {level} learner knows) that names the real rule. No grammar jargon.",
        "examples": [
            ("I travel to Canada for work.", "for work", "to work", "To say why you do something, use to + verb.", "verb_pattern"),
            ("He is doctor.", "is doctor", "is a doctor", "A job needs the word a before it.", "article"),
            ("We discussed about the plan.", "discussed about", "discussed", "The verb discuss does not need about.", "preposition"),
            ("My brothers likes football.", "brothers likes", "brothers like", "Many brothers: the verb has no -s.", "subject_verb_agreement"),
            ("She lives in Oran since three years.", "lives in Oran since three years", "has lived in Oran for three years", "For something that started in the past and goes on: has lived + for a period.", "verb_tense"),
            ("The advices are useful.", "advices are", "advice is", "Advice has no plural, so the verb is singular too.", "plural_uncountable"),
            ("Does he can swim?", "Does he can", "Can he", "Questions with can do not use do.", "other"),
        ],
    },
}


def render(lang: str, level: str) -> dict[str, str]:
    cfg = EXPLAIN[lang]
    lines = [f'- "{s}" -> original "{o}", fixed "{f}", why "{w}", rule "{r}"' for s, o, f, w, r in cfg["examples"]]
    return {"why_rule": cfg["why_rule"].format(level=level), "examples": "\n".join(lines)}
