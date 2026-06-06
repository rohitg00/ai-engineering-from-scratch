"""Handoff-driven orchestration -- OpenAI Swarm in miniature.

Two primitives:
  - Agent(name, instructions, functions)
  - handoff = a function returning an Agent

Run loop detects Agent-valued returns and switches the active agent.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional, Union


@dataclass
class Agent:
    name: str
    instructions: str
    functions: list[Callable] = field(default_factory=list)


@dataclass
class Msg:
    role: str
    content: str
    sender: Optional[str] = None


def triage_agent_factory() -> Agent:
    def transfer_to_refunds() -> "Agent":
        return refund_agent

    def transfer_to_sales() -> "Agent":
        return sales_agent

    def transfer_to_support() -> "Agent":
        return support_agent

    return Agent(
        name="triage",
        instructions="Route user to: refunds, sales, or support.",
        functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
    )


def refund_agent_factory() -> Agent:
    def process_refund(order_id: str) -> str:
        return f"Refund processed for order {order_id}."

    return Agent(
        name="refund",
        instructions="Handle refund requests.",
        functions=[process_refund],
    )


def sales_agent_factory() -> Agent:
    def quote_product(product: str) -> str:
        return f"Quote for {product}: $99/mo."

    return Agent(
        name="sales",
        instructions="Handle sales inquiries.",
        functions=[quote_product],
    )


def support_agent_factory() -> Agent:
    def open_ticket(issue: str) -> str:
        return f"Ticket opened for: {issue}"

    return Agent(
        name="support",
        instructions="Handle technical support.",
        functions=[open_ticket],
    )


triage_agent = triage_agent_factory()
refund_agent = refund_agent_factory()
sales_agent = sales_agent_factory()
support_agent = support_agent_factory()


def scripted_router(current: Agent, user_msg: str) -> Union[str, Agent]:
    """Stands in for an LLM that reads the user message and the current agent's
    system prompt, then either emits text or calls a tool (which may return
    another Agent). In real Swarm this is an LLM tool call."""
    text = user_msg.lower()
    if current.name == "triage":
        if "refund" in text or "money back" in text:
            return next(f for f in current.functions if f.__name__ == "transfer_to_refunds")()
        if "buy" in text or "price" in text:
            return next(f for f in current.functions if f.__name__ == "transfer_to_sales")()
        if "broken" in text or "bug" in text:
            return next(f for f in current.functions if f.__name__ == "transfer_to_support")()
        return "Could you tell me what you need help with?"
    if current.name == "refund":
        order = "42"
        for word in user_msg.split():
            if word.isdigit():
                order = word
                break
        return next(f for f in current.functions if f.__name__ == "process_refund")(order)
    if current.name == "sales":
        product = "enterprise plan"
        return next(f for f in current.functions if f.__name__ == "quote_product")(product)
    if current.name == "support":
        return next(f for f in current.functions if f.__name__ == "open_ticket")(user_msg)
    return "[no response]"


def run_swarm(start_agent: Agent, user_messages: list[str]) -> list[Msg]:
    history: list[Msg] = []
    active = start_agent
    for user in user_messages:
        history.append(Msg(role="user", content=user))
        out = scripted_router(active, user)
        if isinstance(out, Agent):
            history.append(
                Msg(role="assistant", content=f"(handoff to {out.name})", sender=active.name)
            )
            active = out
            out = scripted_router(active, user)
        history.append(Msg(role="assistant", content=str(out), sender=active.name))
    return history


def render(history: list[Msg]) -> None:
    for m in history:
        tag = m.sender if m.sender else m.role
        print(f"  [{tag:>8s}]: {m.content}")


def main() -> None:
    print("Handoff-driven orchestration -- OpenAI Swarm shape")
    print("-" * 54)

    scenarios = [
        ("Refund flow", ["I need a refund on order 77"]),
        ("Sales flow", ["I want to buy the enterprise plan. what's the price?"]),
        ("Support flow", ["my dashboard is broken"]),
        ("Ambiguous", ["hello"]),
    ]
    for label, msgs in scenarios:
        print(f"\n=== {label} ===")
        history = run_swarm(triage_agent, msgs)
        render(history)

    print("\nKey insight: every handoff is a tool call returning an Agent.")
    print("The framework's sole job is detecting Agent-valued returns and switching active agent.")
    print("No state machine. No DSL. The agent prompts ARE the routing logic.")


if __name__ == "__main__":
    main()
