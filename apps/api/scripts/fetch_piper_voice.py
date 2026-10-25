"""Downloads the Piper voice into a folder and checks it against known SHA-256 sums (run by the Dockerfile).

    python scripts/fetch_piper_voice.py /opt/piper

Source: huggingface.co/rhasspy/piper-voices, en_US / lessac / medium (MIT). A file whose sum differs is refused: the image
must not ship a model nobody looked at."""
import hashlib
import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/"
FILES = {
    "en_US-lessac-medium.onnx": "5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f",
    "en_US-lessac-medium.onnx.json": "efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0",
}


def main(folder: str) -> None:
    out = Path(folder)
    out.mkdir(parents=True, exist_ok=True)
    for name, expected in FILES.items():
        data = urllib.request.urlopen(BASE + name, timeout=120).read()
        found = hashlib.sha256(data).hexdigest()
        if found != expected:
            sys.exit(f"{name}: SHA-256 {found} is not the expected {expected}")
        (out / name).write_bytes(data)
        print(f"{name}: {len(data)} bytes, checked")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/opt/piper")
