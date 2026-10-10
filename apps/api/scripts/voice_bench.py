"""Compare the voice providers on the same samples: latency, accuracy, cost, and the end-to-end budget (spec: < 4 s
from the end of the student's speech to the start of the coach's voice, on a phone).

Run from apps/api, keys in apps/api/.env (GROQ_API_KEY, DEEPINFRA_API_KEY; a provider without key is skipped):

    .venv/bin/python scripts/voice_bench.py                    # STT and TTS, 3 runs each
    .venv/bin/python scripts/voice_bench.py --stt --runs 5
    .venv/bin/python scripts/voice_bench.py --agent 2.4        # your agent's measured time for the budget line

STT samples: every audio file in scripts/samples/ (wav, webm, m4a, mp3...), with an optional `name.txt` holding what
was said. Real recordings of your voice and of Algerian accents are far more telling than anything generated:
record 5 to 10 short answers (the app's webm, or a phone recording). Without files, samples are generated with the
macOS `say` command (clean synthetic voice: latency is meaningful, accuracy is flattered).
TTS outputs are saved in scripts/out/ so you can listen to them.
"""
import argparse
import difflib
import re
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.config import settings  # noqa: E402
from app.voice import SttError, TtsError, synthesize, transcribe  # noqa: E402
from app.voice.stt import PROVIDERS as STT_PROVIDERS  # noqa: E402
from app.voice.tts import PROVIDERS as TTS_PROVIDERS  # noqa: E402

HERE = Path(__file__).parent
SAMPLES, OUT = HERE / "samples", HERE / "out"
AUDIO_EXT = {".wav", ".webm", ".m4a", ".mp3", ".ogg", ".mp4", ".flac"}
MIME = {".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".flac": "audio/flac"}
SPOKEN = [
    "I go to the US for study.",
    "My family support me but I have scholarship of DAAD.",
    "After my master I will return to Algeria because my family is there.",
    "Um, I think, uh, I want to work in a company that build software.",
]
REPLIES = [
    "Good. Where do you want to study?",
    "Good, you will study computer science. How will you pay for your studies?",
    "Thank you for your answer. Why do you want to study in the US and not in Algeria? Tell me about your plans.",
]
KEYS = {"groq": lambda: settings.groq_api_key, "deepinfra": lambda: settings.deepinfra_api_key}
STT_USD_PER_HOUR = {"groq": 0.04, "deepinfra": 0.012}
GROQ_MIN_BILLED_S = 10


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, words(a), words(b)).ratio()


def p(values: list[float], q: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, round(q * (len(s) - 1)))]


def load_samples() -> list[tuple[str, bytes, str, str]]:
    """(name, bytes, content type, expected text or '')"""
    found = sorted(f for f in SAMPLES.glob("*") if f.suffix.lower() in AUDIO_EXT) if SAMPLES.exists() else []
    if found:
        return [(f.name, f.read_bytes(), MIME[f.suffix.lower()], f.with_suffix(".txt").read_text().strip() if f.with_suffix(".txt").exists() else "") for f in found]
    print("No file in scripts/samples/: generating synthetic samples with the macOS `say` command.")
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for i, text in enumerate(SPOKEN):
            aiff, wav = Path(tmp) / f"{i}.aiff", Path(tmp) / f"{i}.wav"
            try:
                subprocess.run(["say", "-v", "Samantha", "-o", str(aiff), text], check=True, capture_output=True)
                subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", str(aiff), str(wav)], check=True, capture_output=True)
            except (OSError, subprocess.CalledProcessError):
                sys.exit("Cannot generate samples (needs macOS `say` and `afconvert`): put audio files in scripts/samples/.")
            out.append((f"say-{i}.wav", wav.read_bytes(), "audio/wav", text))
    return out


def wav_seconds(data: bytes) -> float | None:
    if data[:4] == b"RIFF" and len(data) > 44:
        byte_rate = int.from_bytes(data[28:32], "little")
        return (len(data) - 44) / byte_rate if byte_rate else None
    return None


def bench_stt(providers: list[str], runs: int) -> dict[str, float]:
    samples = load_samples()
    print(f"\n=== Speech-to-text: {len(samples)} sample(s) x {runs} run(s) ===")
    print(f"{'provider':10} {'p50':>6} {'p95':>6}  {'match':>6} {'words':>6} {'pauses':>6}  {'$/hour':>7} {'$/answer(5s)':>12}")
    p50s: dict[str, float] = {}
    for name in providers:
        lat, sim, nwords, pauses = [], [], 0, 0
        with httpx.Client(timeout=settings.voice_timeout) as http:  # one connection pool, like the server
            for sample, audio, ctype, expected in samples:
                for _ in range(runs):
                    try:
                        t = transcribe(audio, sample, ctype, provider=name, client=http)
                    except SttError as e:
                        print(f"{name:10} FAILED on {sample}: {e}")
                        break
                    lat.append(t.latency_s)
                    nwords += len(t.words)
                    pauses += t.long_pauses()
                    if expected:
                        sim.append(similarity(t.text, expected))
        if not lat:
            continue
        p50s[name] = statistics.median(lat)
        billed = max(5, GROQ_MIN_BILLED_S) if name == "groq" else 5
        print(f"{name:10} {p50s[name]:6.2f} {p(lat, 0.95):6.2f}  {statistics.mean(sim) if sim else float('nan'):6.0%} {nwords // max(1, len(lat)):6d} {pauses / max(1, len(lat)):6.1f}  {STT_USD_PER_HOUR[name]:7.3f} {STT_USD_PER_HOUR[name] * billed / 3600:12.6f}")
    print("match = word-level similarity with the expected text (1 = identical); words = words with timestamps per answer;")
    print("pauses = silences >= 0.7 s per answer (hesitation signal). Groq bills at least 10 s per request.")
    return p50s


def bench_tts(providers: list[str], runs: int) -> dict[str, float]:
    print(f"\n=== Text-to-speech: {len(REPLIES)} replies x {runs} run(s) ===")
    print(f"{'provider':10} {'first p50':>9} {'first p95':>9} {'full p50':>9}  {'$/reply':>9} {'$/1000':>8}  {'parts':>5}")
    OUT.mkdir(exist_ok=True)
    firsts_p50: dict[str, float] = {}
    for name in providers:
        first, full, cost, parts = [], [], [], []
        with httpx.Client(timeout=settings.voice_timeout) as http:
            for ri, text in enumerate(REPLIES):
                for run in range(runs):
                    try:
                        s = synthesize(text, provider=name, client=http)
                    except TtsError as e:
                        print(f"{name:10} FAILED on reply {ri}: {e}")
                        break
                    first.append(s.first_part_s)
                    full.append(s.latency_s)
                    cost.append(s.cost_usd)
                    parts.append(len(s.parts))
                    if run == 0:
                        ext = {"audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/flac": "flac"}.get(s.mime, "wav")
                        (OUT / f"{name}-reply{ri}.{ext}").write_bytes(s.parts[0])
        if not first:
            continue
        firsts_p50[name] = statistics.median(first)
        print(f"{name:10} {firsts_p50[name]:9.2f} {p(first, 0.95):9.2f} {statistics.median(full):9.2f}  {statistics.mean(cost):9.5f} {statistics.mean(cost) * 1000:8.2f}  {statistics.mean(parts):5.1f}")
    print(f"(first = until the voice can start; audio saved in {OUT.relative_to(HERE.parent)}/ to listen to)")
    return firsts_p50


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stt", action="store_true")
    ap.add_argument("--tts", action="store_true")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--agent", type=float, default=2.0, help="seconds your agent takes to answer (measured with packages/agent/evals/latency.py)")
    a = ap.parse_args()
    do_stt, do_tts = a.stt or not a.tts, a.tts or not a.stt
    have = [n for n in ("groq", "deepinfra") if KEYS[n]()]
    missing = [n for n in ("groq", "deepinfra") if n not in have]
    print("keys found:", ", ".join(have) or "none", "| skipped (no key):", ", ".join(missing) or "none")
    if not have:
        print("Put GROQ_API_KEY and/or DEEPINFRA_API_KEY in apps/api/.env.")
        return 1
    stt = bench_stt([n for n in have if n in STT_PROVIDERS], a.runs) if do_stt else {}
    tts = bench_tts([n for n in have if n in TTS_PROVIDERS], a.runs) if do_tts else {}
    if stt and tts:
        print(f"\n=== End-to-end estimate (STT + agent {a.agent:.1f} s + first voice part), target < 4 s ===")
        for s in stt:
            for t in tts:
                total = stt[s] + a.agent + tts[t]
                print(f"STT {s:9} + TTS {t:9}: {stt[s]:.2f} + {a.agent:.2f} + {tts[t]:.2f} = {total:.2f} s  {'OK' if total < 4 else 'TOO SLOW'}")
        print("Server-side only: add the upload of the audio and the download of the reply on a phone network.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
