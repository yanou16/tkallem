"""Test double for the chat model. Structured calls are answered from one queue per schema (Found for the
corrector, Reply for the coach), so the parallel corrector and coach calls get the right answer in any order."""
import threading
import time
from collections import Counter, defaultdict
from types import SimpleNamespace


class FakeChat:
    def __init__(self, found=None, replies=None, text=None, delay=0.0):
        self.queues = {"Found": list(found or []), "Reply": list(replies or [])}
        self.text = list(text or [])
        self.delay = delay
        self.calls: Counter = Counter()
        self.seen: dict[str, list] = defaultdict(list)
        self.lock = threading.Lock()

    def with_structured_output(self, schema, **kwargs):
        title = schema["title"] if isinstance(schema, dict) else schema.__name__
        parent = self

        class Bound:
            def invoke(self, messages, config=None):
                time.sleep(parent.delay)
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

    def invoke(self, prompt, config=None):  # plain text call: the report note
        with self.lock:
            self.calls["text"] += 1
            out = self.text.pop(0) if self.text else "Good work. Keep practising."
        if isinstance(out, Exception):
            raise out
        return SimpleNamespace(content=out)
