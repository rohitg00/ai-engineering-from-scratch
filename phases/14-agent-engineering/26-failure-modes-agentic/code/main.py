"""Stdlib failure-mode tagger for agent traces.

Detects the five industry-recurring modes: hallucinated actions, scope creep,
cascading errors, context loss, tool misuse. Each detector returns a tag if
the trace matches; aggregate distribution mirrors Phoenix's trace clustering.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TraceStep:
    kind: str
    name: str
    args: dict[str, Any] = field(default_factory=dict)
    status: str = "ok"
    result: str = ""


@dataclass
class Trace:
    tid: str
    user_request: str
    constraints: list[str]
    steps: list[TraceStep]
    final_success_claim: bool
    target_state_changed: bool


KNOWN_TOOLS = {"search", "read_file", "write_file", "list_dir"}


def detect_hallucinated_action(trace: Trace) -> str | None:
    for step in trace.steps:
        if step.kind == "tool_call" and step.name not in KNOWN_TOOLS:
            return "hallucinated_action"
    return None


def detect_scope_creep(trace: Trace) -> str | None:
    request = trace.user_request.lower()
    writes = [s for s in trace.steps
              if s.kind == "tool_call" and s.name == "write_file"]
    explicit_write_words = ("write", "create", "save", "update", "edit")
    wanted_write = any(w in request for w in explicit_write_words)
    if len(writes) > 0 and not wanted_write:
        return "scope_creep"
    return None


def detect_cascading_errors(trace: Trace) -> str | None:
    saw_error = False
    downstream_ops = 0
    for step in trace.steps:
        if step.kind == "tool_call" and step.status == "error":
            saw_error = True
            continue
        if saw_error and step.kind == "tool_call":
            downstream_ops += 1
    if saw_error and downstream_ops >= 2:
        return "cascading_errors"
    return None


def detect_context_loss(trace: Trace) -> str | None:
    for constraint in trace.constraints:
        con_l = constraint.lower()
        if "do not" in con_l:
            forbidden_token = con_l.split("do not")[-1].strip().split()[0]
            for step in trace.steps:
                if step.kind == "tool_call" and forbidden_token in str(step.args).lower():
                    return "context_loss"
    return None


def detect_tool_misuse(trace: Trace) -> str | None:
    tool_args_schema = {
        "read_file": {"path"},
        "write_file": {"path", "content"},
        "list_dir": {"path"},
        "search": {"query"},
    }
    for step in trace.steps:
        if step.kind != "tool_call":
            continue
        expected = tool_args_schema.get(step.name)
        if expected is None:
            continue
        if not expected.issubset(set(step.args.keys())):
            return "tool_misuse"
    return None


def detect_success_hallucination(trace: Trace) -> str | None:
    request = trace.user_request.lower()
    write_intent = any(w in request for w in
                       ("write", "create", "save", "update", "edit", "make"))
    if (write_intent and trace.final_success_claim
            and not trace.target_state_changed):
        return "success_hallucination"
    return None


DETECTORS = (
    detect_hallucinated_action,
    detect_scope_creep,
    detect_cascading_errors,
    detect_context_loss,
    detect_tool_misuse,
    detect_success_hallucination,
)


def tag(trace: Trace) -> list[str]:
    return [label for label in (d(trace) for d in DETECTORS) if label]


def main() -> None:
    print("=" * 70)
    print("AGENT FAILURE MODES — Phase 14, Lesson 26")
    print("=" * 70)

    traces = [
        Trace(tid="t001", user_request="find the config file",
              constraints=["do not modify any files"],
              steps=[
                  TraceStep("tool_call", "search", {"query": "config"}),
                  TraceStep("tool_call", "read_file", {"path": "config.yml"}),
              ],
              final_success_claim=True, target_state_changed=False),
        Trace(tid="t002", user_request="find the config file",
              constraints=["do not modify any files"],
              steps=[
                  TraceStep("tool_call", "search", {"query": "config"}),
                  TraceStep("tool_call", "write_file",
                            {"path": "config.yml", "content": "..."}),
              ],
              final_success_claim=True, target_state_changed=True),
        Trace(tid="t003", user_request="list project files",
              constraints=[],
              steps=[
                  TraceStep("tool_call", "magic_scanner",
                            {"path": "/"}),
              ],
              final_success_claim=True, target_state_changed=False),
        Trace(tid="t004", user_request="look up invoice 4711",
              constraints=[],
              steps=[
                  TraceStep("tool_call", "search",
                            {"query": "invoice 4711"}, status="error"),
                  TraceStep("tool_call", "read_file", {"path": "/tmp/foo"}),
                  TraceStep("tool_call", "write_file",
                            {"path": "/tmp/foo", "content": "fabricated"}),
                  TraceStep("tool_call", "list_dir", {"path": "/tmp"}),
              ],
              final_success_claim=True, target_state_changed=True),
        Trace(tid="t005", user_request="update readme with release notes",
              constraints=["do not modify src/"],
              steps=[
                  TraceStep("tool_call", "read_file", {"path": "README.md"}),
                  TraceStep("tool_call", "write_file",
                            {"path": "README.md", "content": "notes"}),
                  TraceStep("tool_call", "write_file",
                            {"path": "src/foo.py", "content": "also notes"}),
              ],
              final_success_claim=True, target_state_changed=True),
        Trace(tid="t006", user_request="read some file",
              constraints=[],
              steps=[
                  TraceStep("tool_call", "read_file",
                            {"file": "/tmp/foo"}),
              ],
              final_success_claim=False, target_state_changed=False),
        Trace(tid="t007", user_request="create a PR",
              constraints=[],
              steps=[
                  TraceStep("tool_call", "search", {"query": "PR template"}),
              ],
              final_success_claim=True, target_state_changed=False),
    ]

    distribution: Counter = Counter()
    print()
    for trace in traces:
        labels = tag(trace)
        distribution.update(labels)
        print(f"  {trace.tid}  user={trace.user_request[:40]!r}")
        print(f"    labels: {labels if labels else '[clean]'}")

    print("\naggregate distribution")
    for label, count in distribution.most_common():
        print(f"  {label}: {count}")
    print()
    print("gate at every step: classifier, argument validation, state probe.")
    print("cascading is the killer. detect early, stop the loop.")


if __name__ == "__main__":
    main()
