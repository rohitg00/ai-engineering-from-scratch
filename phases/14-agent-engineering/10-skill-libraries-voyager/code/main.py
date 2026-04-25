"""Voyager-shaped skill library: register, retrieve, compose, refine.

Stdlib only. Action space is code; skills are retrievable and composable;
failures feed back into the next version.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Skill:
    name: str
    description: str
    code: str
    fn: Callable[..., Any]
    version: int = 1
    tags: tuple[str, ...] = ()
    depends_on: tuple[str, ...] = ()
    history: list[str] = field(default_factory=list)


class SkillLibrary:
    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill, dedup: bool = True) -> str:
        if dedup and skill.name in self._skills:
            existing = self._skills[skill.name]
            existing.history.append(existing.code)
            existing.code = skill.code
            existing.fn = skill.fn
            existing.description = skill.description
            existing.tags = skill.tags
            existing.depends_on = skill.depends_on
            existing.version += 1
            return f"refined {skill.name} -> v{existing.version}"
        self._skills[skill.name] = skill
        return f"registered {skill.name} v{skill.version}"

    def search(self, query: str, top_k: int = 3,
               tag_filter: str | None = None) -> list[tuple[float, Skill]]:
        q_tokens = set(query.lower().split())
        scored: list[tuple[float, Skill]] = []
        for skill in self._skills.values():
            if tag_filter and tag_filter not in skill.tags:
                continue
            d_tokens = set(skill.description.lower().split())
            if not d_tokens:
                continue
            overlap = len(q_tokens & d_tokens)
            if overlap == 0:
                continue
            score = overlap / len(q_tokens | d_tokens)
            scored.append((score, skill))
        scored.sort(key=lambda x: -x[0])
        return scored[:top_k]

    def get(self, name: str) -> Skill | None:
        return self._skills.get(name)

    def topo_order(self, name: str) -> list[str]:
        visited: set[str] = set()
        order: list[str] = []
        stack = [(name, False)]
        while stack:
            node, processed = stack.pop()
            if processed:
                order.append(node)
                continue
            if node in visited:
                continue
            visited.add(node)
            stack.append((node, True))
            skill = self._skills.get(node)
            if skill is None:
                continue
            for dep in skill.depends_on:
                if dep not in visited:
                    stack.append((dep, False))
        return order

    def execute(self, name: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        if context is None:
            context = {}
        context.setdefault("log", [])
        for skill_name in self.topo_order(name):
            skill = self._skills.get(skill_name)
            if skill is None:
                context["log"].append(f"missing skill: {skill_name}")
                context["failed"] = True
                return context
            try:
                result = skill.fn(context)
                context["log"].append(
                    f"ran {skill.name} v{skill.version}: {result}"
                )
            except Exception as e:
                context["log"].append(
                    f"error in {skill.name} v{skill.version}: "
                    f"{type(e).__name__}: {e}"
                )
                context["failed"] = True
                return context
        context["failed"] = False
        return context

    def list_names(self) -> list[str]:
        return sorted(self._skills)


def _mine(context: dict[str, Any]) -> str:
    context["resources"] = context.get("resources", {})
    context["resources"]["ore"] = context["resources"].get("ore", 0) + 3
    return "+3 ore"


def _place_table(context: dict[str, Any]) -> str:
    context["has_table"] = True
    return "placed crafting table"


def _craft_iron_pick_v1(context: dict[str, Any]) -> str:
    if not context.get("has_table"):
        raise RuntimeError("no crafting table in context — cannot craft")
    ore = context.get("resources", {}).get("ore", 0)
    stick = context.get("resources", {}).get("stick", 0)
    if ore < 3:
        raise RuntimeError(f"need 3 ore, have {ore}")
    if stick < 2:
        raise RuntimeError(f"need 2 stick, have {stick}")
    context["resources"]["ore"] -= 3
    context["resources"]["stick"] -= 2
    context["inventory"] = context.get("inventory", [])
    context["inventory"].append("iron_pickaxe")
    return "crafted iron_pickaxe"


def _craft_iron_pick_v2(context: dict[str, Any]) -> str:
    if not context.get("has_table"):
        return "skipped craft: no table yet"
    ore = context.get("resources", {}).get("ore", 0)
    stick = context.get("resources", {}).get("stick", 0)
    if ore < 3 or stick < 2:
        return f"skipped craft: ore={ore}, stick={stick}"
    context["resources"]["ore"] -= 3
    context["resources"]["stick"] -= 2
    context["inventory"] = context.get("inventory", [])
    context["inventory"].append("iron_pickaxe")
    return "crafted iron_pickaxe"


def _gather_sticks(context: dict[str, Any]) -> str:
    context["resources"] = context.get("resources", {})
    context["resources"]["stick"] = context["resources"].get("stick", 0) + 2
    return "+2 stick"


def main() -> None:
    print("=" * 70)
    print("VOYAGER SKILL LIBRARY — Phase 14, Lesson 10")
    print("=" * 70)

    lib = SkillLibrary()

    print("\nphase 1: register primitive skills")
    print("  " + lib.register(Skill(
        name="mine_ore",
        description="mine iron ore from nearby rock formations",
        code="mine(3)",
        fn=_mine,
        tags=("gather", "ore"),
    )))
    print("  " + lib.register(Skill(
        name="place_crafting_table",
        description="place a crafting table at current position",
        code="place_table()",
        fn=_place_table,
        tags=("setup", "crafting"),
    )))
    print("  " + lib.register(Skill(
        name="gather_sticks",
        description="gather sticks from tree or broken planks",
        code="gather(2, stick)",
        fn=_gather_sticks,
        tags=("gather", "stick"),
    )))

    print("\nphase 2: compose a higher-order skill (v1)")
    print("  " + lib.register(Skill(
        name="craft_iron_pickaxe",
        description="craft an iron pickaxe using ore and a crafting table",
        code="mine_ore(); place_table(); craft('iron_pickaxe')",
        fn=_craft_iron_pick_v1,
        depends_on=("mine_ore", "place_crafting_table"),
        tags=("craft", "tool"),
    )))

    print("\nphase 3: retrieval on 'I need a pickaxe'")
    for score, skill in lib.search("I need a pickaxe"):
        print(f"  {score:.3f}  {skill.name} v{skill.version}: {skill.description}")

    print("\nphase 4: execute craft_iron_pickaxe (expect failure — missing sticks)")
    context = lib.execute("craft_iron_pickaxe")
    for line in context["log"]:
        print(f"  {line}")
    print(f"  failed: {context.get('failed')}")

    print("\nphase 5: iterative refinement — rewrite as v2 with stick deps")
    print("  " + lib.register(Skill(
        name="craft_iron_pickaxe",
        description="craft an iron pickaxe using ore, sticks, and a crafting table",
        code="mine_ore(); gather_sticks(); place_table(); craft('iron_pickaxe')",
        fn=_craft_iron_pick_v2,
        depends_on=("mine_ore", "gather_sticks", "place_crafting_table"),
        tags=("craft", "tool"),
    )))

    print("\nphase 6: re-execute (expect success)")
    context = lib.execute("craft_iron_pickaxe")
    for line in context["log"]:
        print(f"  {line}")
    print(f"  inventory: {context.get('inventory')}")
    print(f"  failed: {context.get('failed')}")

    print("\nlibrary state")
    for name in lib.list_names():
        skill = lib.get(name)
        assert skill is not None
        print(f"  {name} v{skill.version}  deps={skill.depends_on}  "
              f"tags={skill.tags}")

    print()
    print("pattern: retrieve composable skills, execute, fold feedback into v2.")
    print("same loop powers Claude Agent SDK skills and the skillkit registry.")


if __name__ == "__main__":
    main()
