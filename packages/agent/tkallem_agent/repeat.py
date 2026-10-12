""""Say it again" (docs/JURY_BRIEF.md, improvement 2): the student says the corrected sentence out loud, and the code,
not the model, decides whether they got it.

Both sides are normalized (case, punctuation, contractions, number words, filler words such as "um"). The repetition
is accepted when its words are at least 85 % similar to the corrected sentence (difflib ratio on the word sequences)
and every fix is there: each corrected phrase is heard as is, and the original wrong phrase is not ("I am agree" is not
a repetition of "I agree", even if it is 90 % similar)."""
import re
from difflib import SequenceMatcher

from pydantic import BaseModel

SIMILARITY = 0.85
FILLERS = frozenset({"um", "uh", "uhm", "umm", "er", "erm", "ah", "eh", "hmm", "mm", "mmm"})
CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are", "it's": "it is", "he's": "he is",
    "she's": "she is", "that's": "that is", "there's": "there is", "what's": "what is", "here's": "here is",
    "let's": "let us", "can't": "can not", "cannot": "can not", "won't": "will not", "shan't": "shall not",
    "ain't": "is not",
}
SUFFIXES = (("n't", " not"), ("'ll", " will"), ("'ve", " have"), ("'re", " are"), ("'d", " would"))
NUMBERS = {w: str(i) for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
    "seventeen eighteen nineteen twenty".split())}


class RepeatResult(BaseModel):
    nailed: bool
    similarity: float  # 0 to 1, word sequences after normalization
    missing: list[str]  # corrected phrases not heard (to show gently), or wrong phrases heard again
    target: str  # the corrected sentence


def normalize(text: str) -> list[str]:
    """Lower case words, contractions expanded, number words as digits, no punctuation, no filler words."""
    text = text.lower().replace("’", "'").replace("-", " ")
    text = re.sub(r"(?<=\w)\.(?=\w)", "", text)  # U.S. -> us
    out: list[str] = []
    for w in re.findall(r"[a-z0-9']+", text):
        w = w.strip("'")
        if w in CONTRACTIONS:
            out += CONTRACTIONS[w].split()
            continue
        for suffix, full in SUFFIXES:
            if w.endswith(suffix) and len(w) > len(suffix):
                w = (w[: -len(suffix)] + full) if suffix != "n't" else (w[:-3] + full)
                break
        for part in w.split():
            if part and part not in FILLERS:
                out.append(NUMBERS.get(part, part))
    return out


def _contains(words: list[str], phrase: list[str]) -> bool:
    n = len(phrase)
    return n > 0 and any(words[i:i + n] == phrase for i in range(len(words) - n + 1))


def corrected_sentence(text: str, corrections: list[dict]) -> str:
    """The student's sentence with every correction applied (first occurrence, case ignored)."""
    out = text
    for c in corrections:
        original, fixed = str(c.get("original", "")).strip(), str(c.get("fixed", "")).strip()
        if not original:
            continue
        if original.lower().rstrip(".!?") == out.lower().strip().rstrip(".!?"):
            out = fixed
            continue
        out = re.sub(re.escape(original.rstrip(".!?")), fixed.rstrip(".!?"), out, count=1, flags=re.I)
    return out


def match_repeat(text: str, corrections: list[dict], heard: str) -> RepeatResult:
    """Did the student say the corrected version of `text`? `heard` is the transcription of their repetition."""
    target = corrected_sentence(text, corrections)
    want, got = normalize(target), normalize(heard)
    similarity = SequenceMatcher(None, want, got, autojunk=False).ratio() if want and got else 0.0
    missing: list[str] = []
    for c in corrections:
        fixed, original = normalize(str(c.get("fixed", ""))), normalize(str(c.get("original", "")))
        if fixed and not _contains(got, fixed):
            missing.append(str(c.get("fixed", "")).strip().rstrip(".!?"))
        elif original and not _contains(fixed, original) and _contains(got, original):
            missing.append(str(c.get("fixed", "")).strip().rstrip(".!?"))  # said the mistake again
    nailed = similarity >= SIMILARITY and not missing
    return RepeatResult(nailed=nailed, similarity=round(similarity, 3), missing=missing, target=target)
