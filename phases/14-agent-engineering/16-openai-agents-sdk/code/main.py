"""OpenAI Agents SDK-shaped runtime in stdlib.

Five primitives: Agent, FunctionTool, Handoff, Guardrail, Tracing.
Handoffs are tools named transfer_to_<agent>. Guardrails trip on input/output.
A span tree mirrors what the real SDK emits.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


class GuardrailTripped(Exception):
    def __init__(self, which: str, reason: str) -> None:
        super().__init__(f"{which}: {reason}")
        self.which = which
        self.reason = reason


@dataclass
class FunctionTool:
    name: str
    description: str
    fn: Callable[..., str]


@dataclass
class Handoff:
    target: "Agent"

    @property
    def tool_name(self) -> str:
        return f"transfer_to_{self.target.name}"


@dataclass
class Agent:
    name: str
    instructions: str
    policy: Callable[[str], dict[str, Any]]
    tools: list[FunctionTool] = field(default_factory=list)
    handoffs: list[Handoff] = field(default_factory=list)


@dataclass
class InputGuardrail:
    name: str
    check: Callable[[str], tuple[bool, str]]


@dataclass
class OutputGuardrail:
    name: str
    check: Callable[[str], tuple[bool, str]]


@dataclass
class Span:
    name: str
    attributes: dict[str, Any] = field(default_factory=dict)
    children: list["Span"] = field(default_factory=list)


@dataclass
class Runner:
    input_guardrails: list[InputGuardrail] = field(default_factory=list)
    output_guardrails: list[OutputGuardrail] = field(default_factory=list)
    max_hops: int = 3
    trace: Span = field(default_factory=lambda: Span(name="run"))

    def run(self, agent: Agent, user_input: str) -> str:
        for guard in self.input_guardrails:
            ok, reason = guard.check(user_input)
            span = Span(name=f"input_guardrail.{guard.name}",
                        attributes={"passed": ok, "reason": reason})
            self.trace.children.append(span)
            if not ok:
                raise GuardrailTripped("input", reason)

        current_agent = agent
        current_input = user_input
        final_output = ""
        for hop in range(self.max_hops):
            agent_span = Span(name=f"agent.{current_agent.name}",
                              attributes={"hop": hop,
                                          "instructions": current_agent.instructions[:40]})
            self.trace.children.append(agent_span)

            policy_output = current_agent.policy(current_input)
            kind = policy_output["kind"]

            if kind == "final":
                final_output = policy_output["text"]
                agent_span.children.append(
                    Span(name="llm_generation",
                         attributes={"output": final_output[:60]})
                )
                break
            if kind == "tool":
                tool_name = policy_output["tool"]
                args = policy_output.get("args", {})
                tool = next((t for t in current_agent.tools if t.name == tool_name),
                            None)
                if tool is None:
                    agent_span.children.append(
                        Span(name="tool_error",
                             attributes={"tool": tool_name,
                                         "reason": "unknown tool"})
                    )
                    final_output = f"error: unknown tool {tool_name}"
                    break
                result = tool.fn(**args)
                agent_span.children.append(
                    Span(name=f"tool.{tool_name}",
                         attributes={"args": args, "result": result[:40]})
                )
                current_input = f"tool {tool_name} returned: {result}"
                continue
            if kind == "handoff":
                target_name = policy_output["to"]
                handoff = next((h for h in current_agent.handoffs
                                if h.target.name == target_name), None)
                if handoff is None:
                    final_output = f"error: no handoff to {target_name}"
                    break
                agent_span.children.append(
                    Span(name=f"handoff.{handoff.tool_name}",
                         attributes={"from": current_agent.name,
                                     "to": target_name})
                )
                current_agent = handoff.target
                current_input = policy_output.get("input", current_input)
                continue
            final_output = f"error: unknown policy kind {kind}"
            break

        for guard in self.output_guardrails:
            ok, reason = guard.check(final_output)
            span = Span(name=f"output_guardrail.{guard.name}",
                        attributes={"passed": ok, "reason": reason})
            self.trace.children.append(span)
            if not ok:
                raise GuardrailTripped("output", reason)

        return final_output


def _print_span(span: Span, indent: int = 0) -> None:
    prefix = "  " * indent
    attrs = " ".join(f"{k}={v!r}" for k, v in span.attributes.items())
    print(f"{prefix}{span.name}  {attrs}")
    for child in span.children:
        _print_span(child, indent + 1)


def _triage_policy(user_input: str) -> dict[str, Any]:
    t = user_input.lower()
    if "refund" in t or "billing" in t or "invoice" in t:
        return {"kind": "handoff", "to": "billing", "input": user_input}
    if "error" in t or "crash" in t or "bug" in t:
        return {"kind": "handoff", "to": "support", "input": user_input}
    return {"kind": "final", "text": "i'm not sure how to help with that"}


def _billing_policy(user_input: str) -> dict[str, Any]:
    return {"kind": "final", "text": f"billing handled: {user_input[:40]}"}


def _support_policy(user_input: str) -> dict[str, Any]:
    return {"kind": "final", "text": f"support handled: {user_input[:40]}"}


def _pii_check(text: str) -> tuple[bool, str]:
    if "ssn" in text.lower():
        return False, "refuses to process social security numbers"
    return True, "ok"


def _length_check(text: str) -> tuple[bool, str]:
    return len(text) < 200, f"output {len(text)} chars"


def main() -> None:
    print("=" * 70)
    print("OPENAI AGENTS SDK SHAPE — Phase 14, Lesson 16")
    print("=" * 70)

    billing = Agent(name="billing", instructions="handle refunds and invoices",
                    policy=_billing_policy)
    support = Agent(name="support", instructions="handle bugs and errors",
                    policy=_support_policy)
    triage = Agent(
        name="triage", instructions="route queries to the right specialist",
        policy=_triage_policy,
        handoffs=[Handoff(target=billing), Handoff(target=support)],
    )

    runner = Runner(
        input_guardrails=[InputGuardrail("pii_block", _pii_check)],
        output_guardrails=[OutputGuardrail("length_cap", _length_check)],
    )

    cases = [
        "I need a refund for invoice 4711",
        "the CLI crashes on ctrl-c",
        "share my ssn with the team",
    ]
    for case in cases:
        print(f"\n--- case: {case} ---")
        runner.trace = Span(name="run", attributes={"user_input": case[:40]})
        try:
            out = runner.run(triage, case)
            print(f"final: {out}")
        except GuardrailTripped as e:
            print(f"GUARDRAIL: {e}")
        print("span tree:")
        _print_span(runner.trace, indent=1)

    print()
    print("every handoff is a tool named transfer_to_<agent>.")
    print("every guardrail trip is a structured exception, not a crash.")


if __name__ == "__main__":
    main()
