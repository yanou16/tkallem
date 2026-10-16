"""The judge's journey, shared by locustfile.py (what the virtual judge types) and fake_server.py (what the fake model
answers), so both stay in step: each answer has one real mistake, the correction the fake corrector returns for it, and
the goal of the visa-us question it answers (packages/agent/tkallem_agent/scenarios/visa-us.json)."""

SCENARIO_ID = "visa-us"

# (answer typed by the judge, correction the fake corrector finds in it, goal id the fake coach marks as covered)
ANSWERS = [
    (
        "I am going to the US for study a master's degree in computer science.",
        {"original": "for study", "fixed": "to study", "type": "grammar", "why": "Le but : to + verbe.", "rule": "verb_pattern"},
        "purpose_of_trip",
    ),
    (
        "I will attend Boston University and I will studying data science there.",
        {"original": "will studying", "fixed": "will study", "type": "grammar", "why": "Après will : le verbe de base.", "rule": "verb_tense"},
        "chosen_program",
    ),
    (
        "My father pay for my studies and I also have a small scholarship.",
        {"original": "My father pay", "fixed": "My father pays", "type": "grammar", "why": "He / she : pays.", "rule": "subject_verb_agreement"},
        "funding",
    ),
    (
        "Because the programs in the US is more practical than in my country.",
        {"original": "the programs in the US is", "fixed": "the programs in the US are", "type": "grammar", "why": "Programs (pluriel) : are.", "rule": "subject_verb_agreement"},
        "why_abroad",
    ),
    (
        "My family live in Algiers and I already have a job offer there.",
        {"original": "My family live", "fixed": "My family lives", "type": "grammar", "why": "Family (singulier) : lives.", "rule": "subject_verb_agreement"},
        "ties_to_algeria",
    ),
]

REPORT_NOTE = "Clear answers with good details. Work on the verb after will and on he / she + s."
