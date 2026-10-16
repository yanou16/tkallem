"""A virtual judge, as a guest: the real journey of a judge opening the demo link.

    POST /guests -> GET /scenarios -> POST /sessions (visa-us, text) -> 5 x POST /sessions/{id}/turn (SSE) -> POST /end

Run it against loadtest/fake_server.py (see loadtest/README.md). Each step has its own name in Locust's tables. The
turn is timed until the last Server-Sent Event ("done" or "error"), not until the headers; "4a" is the time until the
coach's reply text arrives, what the judge waits before reading.

Shapes read from the code: app/routes/credits.py (GuestCreated: guest_token, credits), app/routes/sessions.py
(SessionCreate: scenario_id, mode; send_turn: form fields text and think_seconds, Accept: text/event-stream;
SessionStarted: session_id), app/schemas/sessions.py (SessionReport).
"""
import json
import os
import random
import time

from locust import HttpUser, between, task

from journey import ANSWERS, SCENARIO_ID

THINK_MIN = float(os.environ.get("LOCUST_THINK_MIN", "2"))  # seconds a judge reads, then starts the next step
THINK_MAX = float(os.environ.get("LOCUST_THINK_MAX", "5"))
TIMEOUT = (10, 120)  # connect, read (seconds): longer than any normal step, so a "timeout" really means stuck


def sse_events(response):
    """(event name, data) for each Server-Sent Event of a streamed response, as the API writes them (app/routes/sessions.py _sse)."""
    name, data = "message", []
    for line in response.iter_lines(decode_unicode=True):
        if line is None:
            continue
        if line == "":
            if data:
                yield name, json.loads("\n".join(data))
            name, data = "message", []
        elif line.startswith("event: "):
            name = line[7:]
        elif line.startswith("data: "):
            data.append(line[6:])
    if data:
        yield name, json.loads("\n".join(data))


class Judge(HttpUser):
    wait_time = between(THINK_MIN, THINK_MAX)

    def _fail(self, response, step: str) -> None:
        detail = ""
        try:
            detail = str(response.json().get("detail"))[:80]
        except Exception:
            pass
        response.failure(f"{step}: HTTP {response.status_code} {detail}".strip())

    @task
    def visa_interview(self) -> None:
        # 1. A new visitor: a signed guest token and 40 free answers.
        with self.client.post("/guests", name="1. POST /guests", timeout=TIMEOUT, catch_response=True) as r:
            if r.status_code != 201:
                return self._fail(r, "guests")
            token = r.json()["guest_token"]
        auth = {"Authorization": f"Guest {token}"}
        self.wait()

        # 2. The welcome page lists the scenarios (public route).
        with self.client.get("/scenarios", name="2. GET /scenarios", timeout=TIMEOUT, catch_response=True) as r:
            if r.status_code != 200 or SCENARIO_ID not in {s["id"] for s in r.json()}:
                return self._fail(r, "scenarios")
        self.wait()

        # 3. "Try a visa interview now", typed answers.
        body = {"scenario_id": SCENARIO_ID, "mode": "text"}
        with self.client.post("/sessions", json=body, headers=auth, name="3. POST /sessions", timeout=TIMEOUT,
                              catch_response=True) as r:
            if r.status_code != 200:
                return self._fail(r, "start")
            session_id = r.json()["session_id"]

        # 4. Five typed answers, each streamed back (transcript, reply, corrections, done).
        for text, _, _ in ANSWERS:
            self.wait()  # reading the question, then typing
            if not self._answer(session_id, text, auth):
                return
        self.wait()

        # 5. The report.
        with self.client.post(f"/sessions/{session_id}/end", headers=auth, name="5. POST /sessions/[id]/end",
                              timeout=TIMEOUT, catch_response=True) as r:
            if r.status_code != 200 or "metrics" not in r.json():
                return self._fail(r, "end")

    def _answer(self, session_id: str, text: str, auth: dict) -> bool:
        """One answer; True when the turn was saved ("done")."""
        form = {"text": (None, text), "think_seconds": (None, f"{random.uniform(1.5, 6):.2f}")}  # multipart, like the app
        headers = {**auth, "Accept": "text/event-stream"}
        t0 = time.perf_counter()
        with self.client.post(f"/sessions/{session_id}/turn", files=form, headers=headers, stream=True,
                              name="4. POST /sessions/[id]/turn (full SSE)", timeout=TIMEOUT, catch_response=True) as r:
            if r.status_code != 200:
                self._fail(r, "turn")
                return False
            outcome, first_reply = None, None
            try:
                for event, data in sse_events(r):
                    if event == "reply" and first_reply is None:
                        first_reply = (time.perf_counter() - t0) * 1000
                    elif event in ("done", "error"):
                        outcome = (event, data)
                        break
            except Exception as exc:  # the stream broke or timed out in the middle
                r.request_meta["response_time"] = (time.perf_counter() - t0) * 1000
                r.failure(f"turn: stream broken ({type(exc).__name__})")
                return False
            # Locust stops its clock at the headers when stream=True: the turn ends with its last event.
            r.request_meta["response_time"] = (time.perf_counter() - t0) * 1000
            if outcome is None:
                r.failure("turn: stream ended without done")
                return False
            if outcome[0] == "error":
                r.failure(f"turn: SSE error {outcome[1].get('status')} {str(outcome[1].get('detail'))[:60]}")
                return False
            r.success()
        if first_reply is not None:
            self.environment.events.request.fire(
                request_type="SSE", name="4a. turn: coach reply received", response_time=first_reply,
                response_length=0, exception=None, context={},
            )
        return True
