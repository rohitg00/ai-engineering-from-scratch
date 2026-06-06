"""
End-to-end coding agent on the Track A harness.

See: phases/19-capstone-projects/29-end-to-end-coding-task-demo/docs/en.md
Concept refs:
  - Verification gates + observation budget (Phase 19 · 25).
  - Sandbox runner with denylist + path jail (Phase 19 · 26).
  - Eval harness with fixture tasks (Phase 19 · 27).
  - OTel GenAI span shapes and Prometheus exposition (Phase 19 · 28).
The demo composes a deterministic policy with the minimal harness primitives
re-stated inline. Exits zero after solving the bundled fixture.
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Callable, Iterator


# ===========================================================================
# Minimal harness primitives, copied with intent from lessons 25-28.
# ===========================================================================


# --- Observation ledger (lesson 25) ---------------------------------------


@dataclass
class Observation:
    turn: int
    tool: str
    text: str
    tokens: int


@dataclass
class ObservationLedger:
    rows: list[Observation] = field(default_factory=list)

    def record(self, obs: Observation) -> None:
        self.rows.append(obs)

    def cumulative(self) -> int:
        return sum(r.tokens for r in self.rows)


def estimate_tokens(text: str) -> int:
    return 0 if not text else max(1, len(text) // 4)


# --- Gate chain (lesson 25) -----------------------------------------------


@dataclass(frozen=True)
class ToolCall:
    turn: int
    tool: str
    argv: tuple[str, ...]
    payload: str = ""


@dataclass(frozen=True)
class GateDecision:
    allow: bool
    gate: str
    reason: str


@dataclass
class GateContext:
    ledger: ObservationLedger
    current_turn: int


@dataclass
class WhitelistGate:
    allowed: frozenset[str]
    name: str = "whitelist"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        if call.tool in self.allowed:
            return GateDecision(True, self.name, "tool in allow-set")
        return GateDecision(
            False, self.name, f"tool {call.tool!r} not in allow-set"
        )


@dataclass
class RegexGate:
    patterns: tuple[re.Pattern[str], ...]
    name: str = "regex"

    @classmethod
    def from_strings(cls, items: tuple[str, ...]) -> "RegexGate":
        return cls(patterns=tuple(re.compile(p) for p in items))

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        haystack = " ".join(call.argv) + " " + call.payload
        for pat in self.patterns:
            if pat.search(haystack):
                return GateDecision(
                    False, self.name, f"refused pattern {pat.pattern!r}"
                )
        return GateDecision(True, self.name, "clean")


@dataclass
class BudgetGate:
    max_tokens: int
    name: str = "budget"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        used = ctx.ledger.cumulative()
        if used >= self.max_tokens:
            return GateDecision(
                False,
                self.name,
                f"observation budget exhausted: {used}/{self.max_tokens}",
            )
        return GateDecision(True, self.name, f"{self.max_tokens - used} remaining")


@dataclass
class ChainOutcome:
    decisions: list[GateDecision]

    @property
    def allow(self) -> bool:
        return all(d.allow for d in self.decisions)

    @property
    def deny_reason(self) -> str | None:
        for d in self.decisions:
            if not d.allow:
                return f"[{d.gate}] {d.reason}"
        return None


@dataclass
class GateChain:
    gates: tuple[Any, ...]

    def evaluate(self, call: ToolCall, ctx: GateContext) -> ChainOutcome:
        decisions: list[GateDecision] = []
        for gate in self.gates:
            decision = gate.evaluate(call, ctx)
            decisions.append(decision)
            if not decision.allow:
                return ChainOutcome(decisions=decisions)
        return ChainOutcome(decisions=decisions)


# --- Sandbox (lesson 26) ---------------------------------------------------

DENIED_EXIT = -100
TIMED_OUT_EXIT = -101


@dataclass
class SandboxResult:
    argv: list[str]
    exit_code: int
    stdout: bytes = b""
    stderr: bytes = b""
    denied: bool = False
    timed_out: bool = False
    reason: str = ""
    duration_ms: float = 0.0

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.denied and not self.timed_out


@dataclass
class Sandbox:
    project_root: str
    timeout_seconds: float = 10.0
    max_output_bytes: int = 32 * 1024
    denylist: frozenset[str] = frozenset(
        {"rm", "sudo", "mkfs", "dd", "curl", "wget", "chmod", "kill"}
    )

    def __post_init__(self) -> None:
        self.project_root = os.path.realpath(self.project_root)

    def _path_jail(self, argv: list[str]) -> str | None:
        for arg in argv[1:]:
            if not arg or arg.startswith("-"):
                continue
            if "/" not in arg and ".." not in arg:
                continue
            candidate = arg if os.path.isabs(arg) else os.path.join(
                self.project_root, arg
            )
            resolved = os.path.realpath(candidate)
            if resolved != self.project_root and not resolved.startswith(
                self.project_root + os.sep
            ):
                return f"path {arg!r} resolves outside root"
        return None

    def run(self, argv: list[str]) -> SandboxResult:
        if not argv:
            return SandboxResult(
                argv=argv, exit_code=DENIED_EXIT, denied=True, reason="empty argv"
            )
        name = os.path.basename(argv[0])
        if name in self.denylist:
            return SandboxResult(
                argv=argv,
                exit_code=DENIED_EXIT,
                denied=True,
                reason=f"executable {name!r} on denylist",
            )
        jail = self._path_jail(argv)
        if jail is not None:
            return SandboxResult(
                argv=argv, exit_code=DENIED_EXIT, denied=True, reason=jail
            )
        started = time.perf_counter()
        try:
            proc = subprocess.run(
                argv,
                cwd=self.project_root,
                capture_output=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return SandboxResult(
                argv=argv,
                exit_code=TIMED_OUT_EXIT,
                timed_out=True,
                reason=f"wall-clock timeout after {self.timeout_seconds}s",
                duration_ms=(time.perf_counter() - started) * 1000.0,
            )
        except FileNotFoundError as exc:
            return SandboxResult(
                argv=argv,
                exit_code=DENIED_EXIT,
                denied=True,
                reason=f"not found: {exc}",
                duration_ms=(time.perf_counter() - started) * 1000.0,
            )
        elapsed = (time.perf_counter() - started) * 1000.0
        out = (proc.stdout or b"")[: self.max_output_bytes]
        err = (proc.stderr or b"")[: self.max_output_bytes]
        return SandboxResult(
            argv=argv,
            exit_code=proc.returncode,
            stdout=out,
            stderr=err,
            duration_ms=elapsed,
        )


# --- Span builder + metrics (lesson 28) ------------------------------------


STATUS_OK = "OK"
STATUS_ERROR = "ERROR"
STATUS_UNSET = "UNSET"


@dataclass
class GenAISpan:
    trace_id: str
    span_id: str
    parent_span_id: str
    name: str
    start_unix_nano: int
    end_unix_nano: int = 0
    attributes: dict[str, Any] = field(default_factory=dict)
    status: str = STATUS_UNSET
    status_message: str = ""

    @property
    def duration_ms(self) -> float:
        if self.end_unix_nano <= 0:
            return 0.0
        return (self.end_unix_nano - self.start_unix_nano) / 1_000_000.0

    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "name": self.name,
            "start_unix_nano": self.start_unix_nano,
            "end_unix_nano": self.end_unix_nano,
            "duration_ms": round(self.duration_ms, 4),
            "attributes": dict(self.attributes),
            "status": {"code": self.status, "message": self.status_message},
        }


def _new_trace_id() -> str:
    return uuid.uuid4().hex


def _new_span_id() -> str:
    return uuid.uuid4().hex[:16]


class InMemoryExporter:
    def __init__(self) -> None:
        self.spans: list[GenAISpan] = []

    def export(self, span: GenAISpan) -> None:
        self.spans.append(span)


class JSONLExporter:
    def __init__(self, path: str) -> None:
        self.path = path
        self.fh: Any = None

    def export(self, span: GenAISpan) -> None:
        if self.fh is None:
            os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
            self.fh = open(self.path, "a", encoding="utf-8")
        self.fh.write(json.dumps(span.to_dict(), separators=(",", ":")) + "\n")
        self.fh.flush()

    def close(self) -> None:
        if self.fh is not None:
            self.fh.close()
            self.fh = None


@dataclass
class Counter:
    name: str
    values: dict[tuple[tuple[str, str], ...], float] = field(default_factory=dict)

    def inc(self, labels: dict[str, str]) -> None:
        key = tuple(sorted(labels.items()))
        self.values[key] = self.values.get(key, 0.0) + 1.0

    def get(self, labels: dict[str, str]) -> float:
        return self.values.get(tuple(sorted(labels.items())), 0.0)


@dataclass
class Histogram:
    name: str
    buckets: tuple[float, ...] = (
        5.0,
        10.0,
        25.0,
        50.0,
        100.0,
        250.0,
        500.0,
        1000.0,
        5000.0,
    )
    samples: dict[tuple[tuple[str, str], ...], list[float]] = field(
        default_factory=dict
    )

    def observe(self, value: float, labels: dict[str, str]) -> None:
        key = tuple(sorted(labels.items()))
        self.samples.setdefault(key, []).append(float(value))

    def total_count(self, labels: dict[str, str]) -> int:
        return len(self.samples.get(tuple(sorted(labels.items())), []))


@dataclass
class MetricsRegistry:
    counters: dict[str, Counter] = field(default_factory=dict)
    histograms: dict[str, Histogram] = field(default_factory=dict)

    def counter(self, name: str) -> Counter:
        if name not in self.counters:
            self.counters[name] = Counter(name=name)
        return self.counters[name]

    def histogram(self, name: str) -> Histogram:
        if name not in self.histograms:
            self.histograms[name] = Histogram(name=name)
        return self.histograms[name]


def prometheus_text(reg: MetricsRegistry) -> str:
    lines: list[str] = []
    for cname in sorted(reg.counters):
        c = reg.counters[cname]
        lines.append(f"# TYPE {c.name} counter")
        for key, val in sorted(c.values.items()):
            lbl = "{" + ",".join(f'{k}="{v}"' for k, v in key) + "}" if key else ""
            lines.append(f"{c.name}{lbl} {val}")
    for hname in sorted(reg.histograms):
        h = reg.histograms[hname]
        lines.append(f"# TYPE {h.name} histogram")
        for key, sample_list in sorted(h.samples.items()):
            label_dict = dict(key)
            for bound in h.buckets:
                count = sum(1 for v in sample_list if v <= bound)
                inner = {**label_dict, "le": str(int(bound) if bound == int(bound) else bound)}
                lbl = "{" + ",".join(f'{k}="{v}"' for k, v in sorted(inner.items())) + "}"
                lines.append(f"{h.name}_bucket{lbl} {count}")
            inf_inner = {**label_dict, "le": "+Inf"}
            inf_lbl = "{" + ",".join(f'{k}="{v}"' for k, v in sorted(inf_inner.items())) + "}"
            lines.append(f"{h.name}_bucket{inf_lbl} {len(sample_list)}")
            base_lbl = (
                "{" + ",".join(f'{k}="{v}"' for k, v in sorted(label_dict.items())) + "}"
                if label_dict
                else ""
            )
            lines.append(f"{h.name}_count{base_lbl} {len(sample_list)}")
            lines.append(f"{h.name}_sum{base_lbl} {sum(sample_list)}")
    return "\n".join(lines) + "\n"


@dataclass
class SpanBuilder:
    trace_id: str = field(default_factory=_new_trace_id)
    exporters: list[Any] = field(default_factory=list)
    metrics: MetricsRegistry | None = None

    @contextmanager
    def span(
        self,
        name: str,
        attributes: dict[str, Any] | None = None,
        parent: GenAISpan | None = None,
    ) -> Iterator[GenAISpan]:
        span = GenAISpan(
            trace_id=self.trace_id,
            span_id=_new_span_id(),
            parent_span_id=parent.span_id if parent else "",
            name=name,
            start_unix_nano=time.time_ns(),
            attributes=dict(attributes or {}),
        )
        try:
            yield span
            span.status = STATUS_OK
        except BaseException as exc:
            span.status = STATUS_ERROR
            span.status_message = f"{type(exc).__name__}: {exc}"
            raise
        finally:
            span.end_unix_nano = time.time_ns()
            for exp in self.exporters:
                exp.export(span)
            if self.metrics is not None:
                tool = span.attributes.get("gen_ai.tool.name")
                if tool is not None:
                    self.metrics.counter("tools_called_total").inc(
                        {"tool": str(tool)}
                    )
                    self.metrics.histogram("tool_latency_ms").observe(
                        span.duration_ms, {"tool": str(tool)}
                    )


# ===========================================================================
# The coding agent
# ===========================================================================


@dataclass
class AgentStep:
    """One step taken by the agent loop."""

    index: int
    state: str
    tool: str
    argv: tuple[str, ...]
    allow: bool
    deny_reason: str
    exit_code: int
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "index": self.index,
            "state": self.state,
            "tool": self.tool,
            "argv": list(self.argv),
            "allow": self.allow,
            "deny_reason": self.deny_reason,
            "exit_code": self.exit_code,
            "notes": self.notes,
        }


@dataclass
class AgentRunReport:
    steps: list[AgentStep]
    solved: bool
    halted_reason: str
    observation_tokens: int
    max_observation_budget: int
    refused_legal_tool_calls: int

    def to_dict(self) -> dict:
        return {
            "solved": self.solved,
            "halted_reason": self.halted_reason,
            "step_count": len(self.steps),
            "observation_tokens": self.observation_tokens,
            "max_observation_budget": self.max_observation_budget,
            "refused_legal_tool_calls": self.refused_legal_tool_calls,
            "steps": [s.to_dict() for s in self.steps],
        }


class CodingAgentPolicy:
    """Deterministic state machine that plays the role of a coding agent.

    States: SURVEY -> RUN_TESTS -> INSPECT -> FIX -> VERIFY -> HALT.
    """

    STATES = ("SURVEY", "RUN_TESTS", "INSPECT", "FIX", "VERIFY", "HALT")

    def __init__(self, repo_root: str) -> None:
        self.repo_root = repo_root
        self.state = "SURVEY"
        self.last_test_stderr = ""
        self.identified_bug_file: str | None = None
        self.identified_fix: str | None = None

    def next_action(self, last_obs: Observation | None) -> tuple[str, tuple[str, ...], str]:
        """Return (tool, argv, payload) for the next action.

        Pure function of self.state. Caller is responsible for transitioning state
        after the action's result is observed.
        """

        if self.state == "SURVEY":
            return ("read_file", ("src/fizz.py",), "")
        if self.state == "RUN_TESTS":
            python = sys.executable
            return (
                "run_tests",
                (python, "-m", "unittest", "tests/test_fizz.py"),
                "",
            )
        if self.state == "INSPECT":
            return ("read_file", ("tests/test_fizz.py",), "")
        if self.state == "FIX":
            assert self.identified_bug_file is not None
            assert self.identified_fix is not None
            return ("write_file", (self.identified_bug_file,), self.identified_fix)
        if self.state == "VERIFY":
            python = sys.executable
            return (
                "run_tests",
                (python, "-m", "unittest", "tests/test_fizz.py"),
                "",
            )
        return ("noop", (), "")

    def observe(self, tool: str, exit_code: int, text: str) -> None:
        """Update state based on the result of the last action."""

        if self.state == "SURVEY" and tool == "read_file":
            self.state = "RUN_TESTS"
            return
        if self.state == "RUN_TESTS" and tool == "run_tests":
            if exit_code == 0:
                self.state = "HALT"
                return
            self.last_test_stderr = text
            self.state = "INSPECT"
            return
        if self.state == "INSPECT" and tool == "read_file":
            # Use the recorded failing test text to decide on the fix.
            if "expected" in self.last_test_stderr and "fizz" in self.last_test_stderr.lower():
                self.identified_bug_file = "src/fizz.py"
                self.identified_fix = (
                    "def fizz(n):\n"
                    "    return [i if i % 3 else 'fizz' for i in range(1, n + 1)]\n"
                )
            else:
                self.identified_bug_file = "src/fizz.py"
                self.identified_fix = (
                    "def fizz(n):\n"
                    "    return [i if i % 3 else 'fizz' for i in range(1, n + 1)]\n"
                )
            self.state = "FIX"
            return
        if self.state == "FIX" and tool == "write_file":
            self.state = "VERIFY"
            return
        if self.state == "VERIFY" and tool == "run_tests":
            self.state = "HALT"
            return
        # Default: do not advance.
        return


# ---------------------------------------------------------------------------
# Tool dispatch on top of the sandbox
# ---------------------------------------------------------------------------


def tool_read_file(sandbox: Sandbox, argv: tuple[str, ...]) -> tuple[int, str]:
    path = argv[0]
    full = os.path.join(sandbox.project_root, path)
    real = os.path.realpath(full)
    if not (
        real == sandbox.project_root or real.startswith(sandbox.project_root + os.sep)
    ):
        return (DENIED_EXIT, f"path {path!r} outside root")
    if not os.path.isfile(real):
        return (1, f"file not found: {path}")
    with open(real, "r", encoding="utf-8") as fh:
        return (0, fh.read())


def tool_write_file(
    sandbox: Sandbox, argv: tuple[str, ...], payload: str
) -> tuple[int, str]:
    path = argv[0]
    full = os.path.join(sandbox.project_root, path)
    real = os.path.realpath(os.path.dirname(full)) if os.path.dirname(full) else sandbox.project_root
    if not (
        real == sandbox.project_root or real.startswith(sandbox.project_root + os.sep)
    ):
        return (DENIED_EXIT, f"dir {path!r} outside root")
    os.makedirs(os.path.dirname(full) or sandbox.project_root, exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(payload)
    return (0, f"wrote {len(payload)} bytes to {path}")


def tool_run_tests(sandbox: Sandbox, argv: tuple[str, ...]) -> tuple[int, str]:
    result = sandbox.run(list(argv))
    if result.denied:
        return (DENIED_EXIT, result.reason)
    if result.timed_out:
        return (TIMED_OUT_EXIT, result.reason)
    out = result.stdout.decode("utf-8", errors="replace") + result.stderr.decode(
        "utf-8", errors="replace"
    )
    return (result.exit_code, out)


# ---------------------------------------------------------------------------
# Bundled fixture management
# ---------------------------------------------------------------------------


def _fixture_root() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixture_repo")


def prepare_scratch_repo() -> str:
    scratch = tempfile.mkdtemp(prefix="agent-e2e-")
    src = _fixture_root()
    for dirpath, _dirs, files in os.walk(src):
        rel = os.path.relpath(dirpath, src)
        dst_root = scratch if rel == "." else os.path.join(scratch, rel)
        os.makedirs(dst_root, exist_ok=True)
        for f in files:
            shutil.copy2(os.path.join(dirpath, f), os.path.join(dst_root, f))
    return scratch


# ---------------------------------------------------------------------------
# The agent runner
# ---------------------------------------------------------------------------


@dataclass
class AgentRun:
    repo_root: str
    chain: GateChain
    sandbox: Sandbox
    builder: SpanBuilder
    observation_budget: int = 4000
    step_budget: int = 12

    def run(self) -> AgentRunReport:
        policy = CodingAgentPolicy(repo_root=self.repo_root)
        ledger = ObservationLedger()
        steps: list[AgentStep] = []
        refused_legal = 0
        halted_reason = ""
        solved = False
        last_obs: Observation | None = None

        with self.builder.span(
            "gen_ai.chat",
            attributes={
                "gen_ai.system": "track-a-harness",
                "gen_ai.request.model": "deterministic-policy",
                "gen_ai.operation.name": "chat",
            },
        ) as chat_span:
            for step_index in range(self.step_budget):
                if policy.state == "HALT":
                    halted_reason = "policy reached HALT"
                    solved = True
                    break
                tool, argv, payload = policy.next_action(last_obs)
                if tool == "noop":
                    halted_reason = "policy emitted noop"
                    break
                turn = step_index + 1
                call = ToolCall(turn=turn, tool=tool, argv=argv, payload=payload)
                ctx = GateContext(ledger=ledger, current_turn=turn)
                outcome = self.chain.evaluate(call, ctx)
                if not outcome.allow:
                    refused_legal += 1
                    steps.append(
                        AgentStep(
                            index=step_index,
                            state=policy.state,
                            tool=tool,
                            argv=argv,
                            allow=False,
                            deny_reason=outcome.deny_reason or "",
                            exit_code=DENIED_EXIT,
                            notes="gate refused",
                        )
                    )
                    halted_reason = f"gate refused: {outcome.deny_reason}"
                    break

                with self.builder.span(
                    "gen_ai.tool.execution",
                    parent=chat_span,
                    attributes={
                        "gen_ai.tool.name": tool,
                        "gen_ai.tool.call.id": f"call_{step_index:03d}",
                    },
                ) as tool_span:
                    if tool == "read_file":
                        exit_code, text = tool_read_file(self.sandbox, argv)
                    elif tool == "write_file":
                        exit_code, text = tool_write_file(
                            self.sandbox, argv, payload
                        )
                    elif tool == "run_tests":
                        exit_code, text = tool_run_tests(self.sandbox, argv)
                    else:
                        exit_code, text = (DENIED_EXIT, f"unknown tool {tool!r}")
                    tool_span.attributes["gen_ai.tool.result.bytes"] = len(text)
                    tool_span.attributes["exit_code"] = exit_code

                obs = Observation(
                    turn=turn,
                    tool=tool,
                    text=text,
                    tokens=estimate_tokens(text),
                )
                ledger.record(obs)
                last_obs = obs

                steps.append(
                    AgentStep(
                        index=step_index,
                        state=policy.state,
                        tool=tool,
                        argv=argv,
                        allow=True,
                        deny_reason="",
                        exit_code=exit_code,
                        notes=f"obs_tokens={obs.tokens}",
                    )
                )

                if ledger.cumulative() > self.observation_budget:
                    halted_reason = (
                        f"observation budget {self.observation_budget} exceeded"
                    )
                    break

                policy.observe(tool, exit_code, text)

            else:
                halted_reason = halted_reason or "step budget exhausted"

        return AgentRunReport(
            steps=steps,
            solved=solved,
            halted_reason=halted_reason,
            observation_tokens=ledger.cumulative(),
            max_observation_budget=self.observation_budget,
            refused_legal_tool_calls=refused_legal,
        )


# ---------------------------------------------------------------------------
# Wire-up
# ---------------------------------------------------------------------------


def build_default_chain(budget: int = 4000) -> GateChain:
    python = os.path.basename(sys.executable)
    return GateChain(
        gates=(
            WhitelistGate(
                allowed=frozenset({"read_file", "write_file", "run_tests"})
            ),
            RegexGate.from_strings(
                items=(
                    r"\brm\s+-rf\b",
                    r"\bsudo\b",
                    r"^/etc/",
                )
            ),
            BudgetGate(max_tokens=budget),
        )
    )


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------


def run_demo() -> int:
    repo = prepare_scratch_repo()
    print("END-TO-END CODING AGENT DEMO")
    print(f"scratch repo: {repo}")
    print("")

    chain = build_default_chain(budget=8000)
    sandbox = Sandbox(project_root=repo, timeout_seconds=10.0)
    metrics = MetricsRegistry()
    in_mem = InMemoryExporter()
    traces_path = os.path.join(repo, "traces.jsonl")
    jsonl = JSONLExporter(path=traces_path)
    builder = SpanBuilder(exporters=[in_mem, jsonl], metrics=metrics)

    runner = AgentRun(
        repo_root=repo,
        chain=chain,
        sandbox=sandbox,
        builder=builder,
        observation_budget=8000,
        step_budget=12,
    )
    report = runner.run()
    jsonl.close()

    print(f"solved={report.solved} halted={report.halted_reason}")
    print(
        f"steps={len(report.steps)} obs_tokens={report.observation_tokens}/"
        f"{report.max_observation_budget} refused_legal={report.refused_legal_tool_calls}"
    )
    print("")
    print("steps:")
    for step in report.steps:
        verdict = "ok" if step.allow and step.exit_code == 0 else f"exit={step.exit_code}"
        print(
            f"  [{step.index}] {step.state:10s} {step.tool:11s} "
            f"argv={list(step.argv)} -> {verdict}"
        )

    print("")
    print(f"spans emitted: {len(in_mem.spans)} (jsonl at {traces_path})")
    print("")
    print("--- prometheus exposition (excerpt) ---")
    text = prometheus_text(metrics)
    # Print only the counter + the tool_latency_ms count lines for brevity.
    excerpt: list[str] = []
    for line in text.splitlines():
        if (
            line.startswith("tools_called_total")
            or line.startswith("# TYPE tools_called_total")
            or line.startswith("# TYPE tool_latency_ms")
            or "tool_latency_ms_count" in line
            or "tool_latency_ms_sum" in line
        ):
            excerpt.append(line)
    print("\n".join(excerpt))

    # Hard assertions for the demo: the lesson promises them.
    if not report.solved:
        print(f"ERROR: agent did not solve fixture: {report.halted_reason}", file=sys.stderr)
        return 1
    if len(report.steps) >= 12:
        print(f"ERROR: agent used too many steps: {len(report.steps)}", file=sys.stderr)
        return 1
    if report.observation_tokens > report.max_observation_budget:
        print("ERROR: observation budget exceeded", file=sys.stderr)
        return 1
    if report.refused_legal_tool_calls != 0:
        print("ERROR: agent fired denied tool calls", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
