"""handoff-driven orchestration -- OpenAI Swarm のミニチュア。

2つの primitive:
  - Agent(name, instructions, functions)
  - handoff = Agent を返す function

run loop は Agent-valued return を検出し、active agent を切り替える。
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
        instructions="user を refunds、sales、support のいずれかに route する。",
        functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
    )


def refund_agent_factory() -> Agent:
    def process_refund(order_id: str) -> str:
        return f"order {order_id} の返金を処理しました。"

    return Agent(
        name="refund",
        instructions="返金 request を扱う。",
        functions=[process_refund],
    )


def sales_agent_factory() -> Agent:
    def quote_product(product: str) -> str:
        return f"{product} の見積もり: $99/mo."

    return Agent(
        name="sales",
        instructions="sales inquiry を扱う。",
        functions=[quote_product],
    )


def support_agent_factory() -> Agent:
    def open_ticket(issue: str) -> str:
        return f"ticket を作成しました: {issue}"

    return Agent(
        name="support",
        instructions="technical support を扱う。",
        functions=[open_ticket],
    )


triage_agent = triage_agent_factory()
refund_agent = refund_agent_factory()
sales_agent = sales_agent_factory()
support_agent = support_agent_factory()


def scripted_router(current: Agent, user_msg: str) -> Union[str, Agent]:
    """user message と current agent の system prompt を読み、text を出すか
    tool を呼ぶ (別 Agent を返す場合がある) LLM の代役。
    実際の Swarm では LLM tool call になる。"""
    text = user_msg.lower()
    if current.name == "triage":
        if "refund" in text or "money back" in text:
            return next(f for f in current.functions if f.__name__ == "transfer_to_refunds")()
        if "buy" in text or "price" in text:
            return next(f for f in current.functions if f.__name__ == "transfer_to_sales")()
        if "broken" in text or "bug" in text:
            return next(f for f in current.functions if f.__name__ == "transfer_to_support")()
        return "何について手伝えばよいか教えてください。"
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
    return "[応答なし]"


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
    print("handoff-driven orchestration -- OpenAI Swarm shape")
    print("-" * 54)

    scenarios = [
        ("Refund flow", ["I need a refund on order 77"]),
        ("Sales flow", ["I want to buy the enterprise plan. what's the price?"]),
        ("Support flow", ["my dashboard is broken"]),
        ("曖昧な入力", ["hello"]),
    ]
    for label, msgs in scenarios:
        print(f"\n=== {label} ===")
        history = run_swarm(triage_agent, msgs)
        render(history)

    print("\nKey insight: すべての handoff は Agent を返す tool call。")
    print("framework の唯一の仕事は Agent-valued return を検出し、active agent を切り替えること。")
    print("state machine も DSL もない。agent prompt そのものが routing logic。")


if __name__ == "__main__":
    main()
