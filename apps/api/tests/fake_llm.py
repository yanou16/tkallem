"""Copied from packages/agent/tests/fakes.py (owned by Rayane) so the API tests can run the real agent
without calling an LLM. Structured calls are answered from one queue per schema: Found for the corrector,
Reply for the coach."""
import threading
from collections import Counter, defaultdict
from types import SimpleNamespace


class FakeChat:
    def __init__(self, found=None, replies=None, text=None):
        self.queues = {"Found": list(found or []), "Reply": list(replies or [])}
        self.text = list(text or [])
        self.calls: Counter = Counter()
        self.seen: dict[str, list] = defaultdict(list)
        self.lock = threading.Lock()

    def with_structured_output(self, schema, **kwargs):
        title = schema["title"] if isinstance(schema, dict) else schema.__name__
        parent = self

        class Bound:
            def invoke(self, messages, config=None):
                with parent.lock:
                    parent.calls[title] += 1
                    parent.seen[title].append(messages)
                    if not parent.queues[title]:
                        raise AssertionError(f"no fake output left for {title}")
                    out = parent.queues[title].pop(0)
                if isinstance(out, Exception):
                    raise out
                return out

        return Bound()

    def invoke(self, prompt, config=None):
        with self.lock:
            self.calls["text"] += 1
            out = self.text.pop(0) if self.text else "Good work. Keep practising."
        if isinstance(out, Exception):
            raise out
        return SimpleNamespace(content=out)