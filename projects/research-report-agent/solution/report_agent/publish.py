"""Serialize verified evidence and render it with the typed Node viewer.

Lesson: projects/research-report-agent/stages/06-publish-the-report/docs/en.md
Python owns the report and trace; TypeScript validates source spans and escapes
HTML. Node 22.18+ runs erasable types without a third-party transpiler.
"""

import json
import subprocess
import time
import uuid
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path


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
    numbers = {}
    for section in report.sections:
        for sentence in section.sentences:
            for cite in sentence.cites:
                numbers.setdefault(cite, len(numbers) + 1)
    return numbers


def report_payload(report, documents, trace=None):
    return {
        "schema_version": 1,
        **asdict(report),
        "documents": [asdict(doc) for doc in documents],
        "trace": trace,
    }


def render_html(report, documents, trace=None):
    renderer = Path(__file__).resolve().parents[1] / "viewer" / "render.ts"
    result = subprocess.run(
        ["node", str(renderer)],
        input=json.dumps(report_payload(report, documents, trace)),
        capture_output=True,
        text=True,
        timeout=20,
    )
    if result.returncode:
        raise RuntimeError("TypeScript viewer failed: " + result.stderr.strip())
    return result.stdout


def write_outputs(out_dir, html_text, trace_dict, report_data=None):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.html").write_text(html_text, encoding="utf-8")
    (out / "trace.json").write_text(json.dumps(trace_dict, indent=2), encoding="utf-8")
    if report_data is not None:
        (out / "report.json").write_text(
            json.dumps(report_data, indent=2), encoding="utf-8"
        )
    return out / "report.html", out / "trace.json"
