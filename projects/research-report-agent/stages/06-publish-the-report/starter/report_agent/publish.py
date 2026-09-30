"""Publish a verified report as HTML with footnotes, plus a JSON trace.

Lesson: projects/research-report-agent/stages/06-publish-the-report/docs/en.md
Footnotes are numbered in order of first use, and every footnote quotes the
exact snippet text and links its source. Stdlib only.
"""

import html
import json
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

STYLE = """
body{font:17px/1.6 Georgia,serif;max-width:46rem;margin:3rem auto;padding:0 1rem;color:#1d1d1b;background:#fbfaf7}
h1{font-size:1.9rem;line-height:1.25}h2{font-size:1.2rem;margin-top:2rem}
sup a{text-decoration:none;font-size:.75em}
.meta{color:#6b6b66;font:13px/1.4 ui-monospace,monospace}
.footnotes li,.sources li{margin:.4rem 0;font-size:.92rem}
blockquote{margin:.2rem 0;color:#44443f}
""".strip()


class Tracer:
    def __init__(self, question, run_id=None):
        self.run_id = run_id or uuid.uuid4().hex[:12]
        self.question = question
        self.started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.steps = []
        self.counts = {}
        self.budget = {}
        self.terminal_state = None

    @contextmanager
    def step(self, name, **detail):
        start = time.perf_counter()
        record = {"name": name, "detail": dict(detail)}
        try:
            yield record["detail"]
        finally:
            record["ms"] = round((time.perf_counter() - start) * 1000, 3)
            self.steps.append(record)

    def to_dict(self):
        return {
            "run_id": self.run_id,
            "question": self.question,
            "started_at": self.started_at,
            "steps": self.steps,
            "counts": self.counts,
            "budget": self.budget,
            "terminal_state": self.terminal_state,
        }


def footnote_numbers(report):
    """Map each cited snippet id to a footnote number in order of first use."""
    raise NotImplementedError(
        "Stage 6: implement footnote_numbers in report_agent/publish.py"
    )


def report_payload(report, documents, trace=None):
    """Return the version 1 JSON contract consumed by viewer/render.ts."""
    raise NotImplementedError("Stage 6: implement report_payload")


def render_html(report, documents, trace=None):
    """Send the serialized payload to Node viewer/render.ts; return its HTML."""
    raise NotImplementedError("Stage 6: implement the TypeScript process adapter")


def write_outputs(out_dir, html_text, trace_dict, report_data=None):
    """Write report.html, trace.json and report.json; return HTML and trace paths."""
    raise NotImplementedError("Stage 6: implement write_outputs")
