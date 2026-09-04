"""
Verification gates and observation budget for an agent harness.

See: phases/19-capstone-projects/25-verification-gates-observation-budget/docs/en.md
Concept refs:
  - Gate-chain pattern (cheapest deny first, allow last).
  - Observation budget as a deterministic stopping criterion.
The demo at the bottom runs a synthetic three-turn loop and exits zero.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from typing import Callable, Iterable, Protocol


# ---------------------------------------------------------------------------
# Wire shapes
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ToolCall:
    """A request from the model to invoke a tool."""

    turn: int
    tool: str
    argv: tuple[str, ...]
    payload: str = ""

    def to_dict(self) -> dict:
        return {
            "turn": self.turn,
            "tool": self.tool,
            "argv": list(self.argv),
            "payload": self.payload,
        }


@dataclass(frozen=True)
class Observation:
    """The text the model is shown after a tool call."""

    turn: int
    tool: str
    text: str
    tokens: int

    def to_dict(self) -> dict:
        return {
            "turn": self.turn,
            "tool": self.tool,
            "tokens": self.tokens,
        }


@dataclass(frozen=True)
class GateDecision:
    """A single gate's verdict."""

    allow: bool
    gate: str
    reason: str

    def to_dict(self) -> dict:
        return {"allow": self.allow, "gate": self.gate, "reason": self.reason}


# ---------------------------------------------------------------------------
# Token estimator
# ---------------------------------------------------------------------------


def estimate_tokens(text: str) -> int:
    """A deterministic, conservative stand-in for a real tokenizer.

    Real harnesses plug in tiktoken or the model's own tokenizer.
    The gate chain only cares that the counter is monotonic and deterministic.
    """

    if not text:
        return 0
    return max(1, len(text) // 4)


# ---------------------------------------------------------------------------
# Observation ledger
# ---------------------------------------------------------------------------


@dataclass
class ObservationLedger:
    """Append-only ledger of every observation the model has been shown."""

    rows: list[Observation] = field(default_factory=list)

    def record(self, obs: Observation) -> None:
        self.rows.append(obs)

    def cumulative(self) -> int:
        return sum(row.tokens for row in self.rows)

    def per_tool(self, name: str) -> int:
        return sum(row.tokens for row in self.rows if row.tool == name)

    def turns_seen(self) -> list[int]:
        return sorted({row.turn for row in self.rows})

    def latest_turn(self) -> int:
        return self.rows[-1].turn if self.rows else -1

    def snapshot(self) -> list[dict]:
        return [row.to_dict() for row in self.rows]


# ---------------------------------------------------------------------------
# Gate protocol
# ---------------------------------------------------------------------------


@dataclass
class GateContext:
    """Read-only context passed to every gate."""

    ledger: ObservationLedger
    current_turn: int
    history: tuple[ToolCall, ...] = ()


class VerificationGate(Protocol):
    name: str

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision: ...


# ---------------------------------------------------------------------------
# Concrete gates
# ---------------------------------------------------------------------------


@dataclass
class WhitelistGate:
    """Refuse any tool not in the explicit allow-set. Cheapest gate."""

    allowed: frozenset[str]
    name: str = "whitelist"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        if call.tool in self.allowed:
            return GateDecision(True, self.name, "tool in allow-set")
        return GateDecision(
            False,
            self.name,
            f"tool {call.tool!r} not in allow-set {sorted(self.allowed)}",
        )


@dataclass
class RegexGate:
    """Refuse a call whose argv joins to a string matching any refuse pattern."""

    refuse_patterns: tuple[re.Pattern[str], ...]
    name: str = "regex"

    @classmethod
    def from_strings(cls, patterns: Iterable[str], name: str = "regex") -> "RegexGate":
        compiled = tuple(re.compile(p) for p in patterns)
        return cls(refuse_patterns=compiled, name=name)

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        haystack = " ".join(call.argv) + " " + call.payload
        for pat in self.refuse_patterns:
            if pat.search(haystack):
                return GateDecision(
                    False, self.name, f"argv matched refuse pattern {pat.pattern!r}"
                )
        return GateDecision(True, self.name, "no refuse pattern matched")


@dataclass
class RecencyGate:
    """Refuse a call if the last observation is more than window turns old.

    The intent is to force a fresh read instead of relying on stale state.
    The first call in a session always passes.
    """

    window: int
    name: str = "recency"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        last = ctx.ledger.latest_turn()
        if last < 0:
            return GateDecision(True, self.name, "no prior observations")
        gap = call.turn - last
        if gap > self.window:
            return GateDecision(
                False,
                self.name,
                f"observation gap {gap} turns exceeds window {self.window}",
            )
        return GateDecision(True, self.name, f"gap {gap} within window {self.window}")


@dataclass
class BudgetGate:
    """Refuse a call once the cumulative observation budget is exhausted.

    A single call cannot in advance know how many tokens its result will be.
    The gate is therefore evaluated against the ledger as it stands before the
    call, and the harness re-runs the cumulative check against the new ledger
    state after recording the observation.
    """

    max_tokens: int
    name: str = "budget"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        used = ctx.ledger.cumulative()
        if used >= self.max_tokens:
            return GateDecision(
                False,
                self.name,
                f"observation budget exhausted: {used}/{self.max_tokens} tokens",
            )
        remaining = self.max_tokens - used
        return GateDecision(
            True, self.name, f"{remaining} tokens of budget remaining"
        )


@dataclass
class PerToolBudgetGate:
    """Optional gate: refuse if a single tool has consumed more than its share."""

    limits: dict[str, int]
    name: str = "per-tool-budget"

    def evaluate(self, call: ToolCall, ctx: GateContext) -> GateDecision:
        limit = self.limits.get(call.tool)
        if limit is None:
            return GateDecision(True, self.name, "tool has no per-tool budget")
        used = ctx.ledger.per_tool(call.tool)
        if used >= limit:
            return GateDecision(
                False,
                self.name,
                f"per-tool budget for {call.tool} exhausted: {used}/{limit}",
            )
        return GateDecision(
            True, self.name, f"per-tool {call.tool}: {limit - used} tokens remaining"
        )


# ---------------------------------------------------------------------------
# Gate chain
# ---------------------------------------------------------------------------


@dataclass
class ChainOutcome:
    """The full result of a chain evaluation: the per-gate decisions plus a final verdict."""

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

    def to_dict(self) -> dict:
        return {
            "allow": self.allow,
            "deny_reason": self.deny_reason,
            "decisions": [d.to_dict() for d in self.decisions],
        }


@dataclass
class GateChain:
    """Ordered list of gates evaluated with short-circuit on first deny."""

    gates: tuple[VerificationGate, ...]

    def evaluate(self, call: ToolCall, ctx: GateContext) -> ChainOutcome:
        decisions: list[GateDecision] = []
        for gate in self.gates:
            decision = gate.evaluate(call, ctx)
            decisions.append(decision)
            if not decision.allow:
                return ChainOutcome(decisions=decisions)
        return ChainOutcome(decisions=decisions)


# ---------------------------------------------------------------------------
# Mini synthetic agent loop for the demo
# ---------------------------------------------------------------------------


ToolFn = Callable[[ToolCall], str]


@dataclass
class LoopReport:
    """Audit record of a synthetic loop run."""

    turns: int
    allowed: int
    refused: int
    observations: list[Observation]
    decisions: list[ChainOutcome]

    def to_dict(self) -> dict:
        return {
            "turns": self.turns,
            "allowed": self.allowed,
            "refused": self.refused,
            "observations": [o.to_dict() for o in self.observations],
            "decisions": [d.to_dict() for d in self.decisions],
        }


def run_synthetic_loop(
    calls: list[ToolCall],
    chain: GateChain,
    tool_fns: dict[str, ToolFn],
) -> LoopReport:
    """Run a fixed sequence of tool calls through the chain.

    This is the harness skeleton in miniature. A real harness would consult
    the model for the next tool call; the gate-chain contract is identical.
    """

    ledger = ObservationLedger()
    decisions: list[ChainOutcome] = []
    observations: list[Observation] = []
    allowed = 0
    refused = 0

    history: list[ToolCall] = []

    for call in calls:
        ctx = GateContext(
            ledger=ledger, current_turn=call.turn, history=tuple(history)
        )
        outcome = chain.evaluate(call, ctx)
        decisions.append(outcome)
        history.append(call)
        if not outcome.allow:
            refused += 1
            continue
        fn = tool_fns.get(call.tool)
        if fn is None:
            refused += 1
            continue
        result = fn(call)
        obs = Observation(
            turn=call.turn,
            tool=call.tool,
            text=result,
            tokens=estimate_tokens(result),
        )
        ledger.record(obs)
        observations.append(obs)
        allowed += 1

    return LoopReport(
        turns=len(calls),
        allowed=allowed,
        refused=refused,
        observations=observations,
        decisions=decisions,
    )


# ---------------------------------------------------------------------------
# Demo wiring
# ---------------------------------------------------------------------------


def _demo_tools() -> dict[str, ToolFn]:
    """Three synthetic tools. read_file is verbose, list_dir is small, run_tests is structured."""

    def read_file(call: ToolCall) -> str:
        target = call.argv[0] if call.argv else "<missing>"
        return (
            f"# fake contents of {target}\n"
            + ("line of fake source code that is sixty bytes long " * 12)
        )

    def list_dir(call: ToolCall) -> str:
        return "main.py\nREADME.md\ntests/test_main.py\n"

    def run_tests(call: ToolCall) -> str:
        return json.dumps(
            {"status": "passed", "tests": 4, "duration_ms": 42}, indent=2
        )

    return {"read_file": read_file, "list_dir": list_dir, "run_tests": run_tests}


def build_default_chain(budget: int = 200) -> GateChain:
    """Wire the canonical four-gate chain in the order documented in en.md."""

    return GateChain(
        gates=(
            WhitelistGate(
                allowed=frozenset({"read_file", "list_dir", "run_tests"})
            ),
            RegexGate.from_strings(
                patterns=(
                    r"\brm\s+-rf\b",
                    r"\bsudo\b",
                    r"^/etc/",
                )
            ),
            RecencyGate(window=3),
            BudgetGate(max_tokens=budget),
        )
    )


def run_demo() -> int:
    """Self-terminating demo. Prints a JSON trace and exits zero."""

    chain = build_default_chain(budget=200)
    tools = _demo_tools()

    calls = [
        ToolCall(turn=1, tool="list_dir", argv=("./",)),
        ToolCall(turn=2, tool="read_file", argv=("main.py",)),
        ToolCall(turn=3, tool="read_file", argv=("README.md",)),
        ToolCall(turn=4, tool="run_tests", argv=("./",)),
        ToolCall(turn=5, tool="shell", argv=("rm", "-rf", "/")),
    ]

    report = run_synthetic_loop(calls, chain, tools)

    print("VERIFICATION GATE DEMO")
    print(f"turns={report.turns} allowed={report.allowed} refused={report.refused}")
    print("")
    for idx, (call, outcome) in enumerate(zip(calls, report.decisions)):
        verdict = "ALLOW" if outcome.allow else "DENY"
        print(f"  [{idx}] turn={call.turn} tool={call.tool} -> {verdict}")
        if not outcome.allow:
            print(f"        reason: {outcome.deny_reason}")
    print("")
    print(f"cumulative tokens observed: {sum(o.tokens for o in report.observations)}")
    print(f"observations recorded: {len(report.observations)}")

    if report.refused < 1:
        print("ERROR: demo expected at least one refusal", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_demo())
