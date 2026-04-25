"""Toy web-agent harness with execution-based eval and trajectory efficiency.

Models a minimal shopping app; 3 tasks with gold trajectories; a scripted agent
attempts each task; we record success + steps-over-gold per OSWorld-Human.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


class ShoppingApp:
    def __init__(self) -> None:
        self.items = {
            "sku-001": {"name": "headphones", "price": 199},
            "sku-002": {"name": "keyboard", "price": 129},
            "sku-003": {"name": "mouse", "price": 59},
        }
        self.cart: dict[str, int] = {}
        self.orders: list[dict[str, Any]] = []

    def list_items(self) -> list[dict[str, Any]]:
        return [{"sku": sku, **meta} for sku, meta in self.items.items()]

    def add_to_cart(self, sku: str, qty: int = 1) -> str:
        if sku not in self.items:
            return "error: unknown sku"
        self.cart[sku] = self.cart.get(sku, 0) + qty
        return f"added {qty} x {sku}"

    def remove_from_cart(self, sku: str) -> str:
        if sku not in self.cart:
            return "error: not in cart"
        del self.cart[sku]
        return f"removed {sku}"

    def checkout(self) -> str:
        if not self.cart:
            return "error: empty cart"
        total = sum(self.items[sku]["price"] * qty
                    for sku, qty in self.cart.items())
        oid = f"ord-{len(self.orders) + 1:03d}"
        self.orders.append({"oid": oid, "items": dict(self.cart), "total": total})
        self.cart = {}
        return oid


@dataclass
class Task:
    tid: str
    description: str
    agent: Callable[[ShoppingApp], list[str]]
    gold_steps: int
    success: Callable[[ShoppingApp], bool]


def _agent_task_1(app: ShoppingApp) -> list[str]:
    trace: list[str] = []
    trace.append(f"list_items -> {len(app.list_items())} items")
    trace.append(f"add_to_cart sku-001 -> {app.add_to_cart('sku-001')}")
    trace.append(f"checkout -> {app.checkout()}")
    return trace


def _agent_task_2(app: ShoppingApp) -> list[str]:
    trace: list[str] = []
    trace.append(f"list_items")
    app.list_items()
    trace.append(f"add_to_cart sku-002 -> {app.add_to_cart('sku-002')}")
    trace.append(f"add_to_cart sku-003 -> {app.add_to_cart('sku-003')}")
    trace.append(f"checkout -> {app.checkout()}")
    return trace


def _agent_task_3(app: ShoppingApp) -> list[str]:
    trace: list[str] = []
    trace.append(f"list_items")
    app.list_items()
    trace.append(f"add_to_cart sku-001 -> {app.add_to_cart('sku-001')}")
    trace.append(f"add_to_cart sku-002 -> {app.add_to_cart('sku-002')}")
    trace.append("revised_choice: remove keyboard")
    trace.append(f"remove_from_cart sku-002 -> {app.remove_from_cart('sku-002')}")
    trace.append(f"add_to_cart sku-003 -> {app.add_to_cart('sku-003')}")
    trace.append(f"checkout -> {app.checkout()}")
    return trace


def main() -> None:
    print("=" * 70)
    print("WEBARENA/OSWORLD-STYLE HARNESS — Phase 14, Lesson 20")
    print("=" * 70)

    tasks = [
        Task(
            tid="buy_headphones",
            description="buy the headphones",
            agent=_agent_task_1,
            gold_steps=3,
            success=lambda app: any(
                o["items"].get("sku-001") == 1 for o in app.orders
            ),
        ),
        Task(
            tid="buy_bundle",
            description="buy keyboard + mouse as a bundle",
            agent=_agent_task_2,
            gold_steps=4,
            success=lambda app: any(
                o["items"].get("sku-002") == 1 and o["items"].get("sku-003") == 1
                for o in app.orders
            ),
        ),
        Task(
            tid="revised_order",
            description="swap keyboard for mouse mid-order",
            agent=_agent_task_3,
            gold_steps=5,
            success=lambda app: any(
                o["items"].get("sku-001") == 1 and
                o["items"].get("sku-003") == 1 and
                "sku-002" not in o["items"]
                for o in app.orders
            ),
        ),
    ]

    total_success = 0
    total_steps = 0
    total_gold = 0
    for task in tasks:
        app = ShoppingApp()
        trace = task.agent(app)
        ok = task.success(app)
        steps = len(trace)
        efficiency = steps / task.gold_steps
        print(f"\n[{task.tid}] {task.description}")
        print(f"  success: {ok}")
        print(f"  steps:   {steps}  (gold {task.gold_steps}, "
              f"efficiency {efficiency:.2f}x)")
        for line in trace:
            print(f"    - {line}")
        if ok:
            total_success += 1
        total_steps += steps
        total_gold += task.gold_steps

    print(f"\naggregate")
    print(f"  success rate:     {total_success}/{len(tasks)}")
    print(f"  step efficiency:  {total_steps / total_gold:.2f}x over gold")
    print()
    print("WebArena: execution-based, gym APIs, state check decides success.")
    print("OSWorld-Human: gold trajectories reveal 1.4-2.7x step inefficiency.")


if __name__ == "__main__":
    main()
