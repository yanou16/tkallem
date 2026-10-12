"""Test double for the chat model, shared by the agent tests and the API tests (no LLM call, no network).

    from tkallem_agent.testing import FakeChat
    llm = FakeChat(found=[{"corrections": []}], replies=[{"reaction": "Good.", "goal_covered": None}], text=["note"])
    session = CoachSession("visa-us", "B1", llm=llm)

Structured calls are answered from one queue per schema (`found` for the corrector, `replies` for the coach,
`starters` and `english` for "Help me start"), so the
parallel corrector and coach calls get the right answer in any order. An `Exception` in a queue is raised instead of
returned. `text` answers plain calls (the report note), `delay` slows every structured call, `calls` and `seen` record
what the agent did."""
import threading
import time
from collections import Counter, defaultdict
from types import SimpleNamespace


class FakeChat:
    def __init__(self, found=None, replies=None, text=None, delay=0.0, starters=None, english=None):
        self.queues = {"Found": list(found or []), "Reply": list(replies or []),
                       "Starters": list(starters or []), "English": list(english or [])}
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
