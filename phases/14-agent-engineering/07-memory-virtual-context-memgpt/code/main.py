"""MemGPT-shaped two-tier memory in stdlib.

Main context is a fixed-size prompt buffer (core dict + messages list).
Archival memory is an external searchable store. Agents page data in and out
via memory tools. No LLM call — a scripted agent drives the scenario so the
control flow is testable offline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Message:
    role: str
    text: str


@dataclass
class MainContext:
    core: dict[str, str] = field(default_factory=dict)
    messages: list[Message] = field(default_factory=list)
    max_messages: int = 4
    evicted: list[Message] = field(default_factory=list)

    def append(self, role: str, text: str) -> None:
        self.messages.append(Message(role=role, text=text))
        while len(self.messages) > self.max_messages:
            self.evicted.append(self.messages.pop(0))

    def render(self) -> str:
        parts: list[str] = ["[core]"]
        for key, value in sorted(self.core.items()):
            parts.append(f"  {key}: {value}")
        parts.append("[messages]")
        for msg in self.messages:
            parts.append(f"  {msg.role}: {msg.text}")
        return "\n".join(parts)


@dataclass
class ArchivalRecord:
    rid: str
    text: str
    tags: tuple[str, ...] = ()
    session_id: str = "s0"
    turn_id: int = 0


class ArchivalStore:
    def __init__(self) -> None:
        self._records: list[ArchivalRecord] = []
        self._counter = 0

    def insert(self, text: str, *, tags: tuple[str, ...] = (),
               session_id: str = "s0", turn_id: int = 0) -> str:
        self._counter += 1
        rid = f"a{self._counter:03d}"
        self._records.append(ArchivalRecord(
            rid=rid, text=text, tags=tags,
            session_id=session_id, turn_id=turn_id,
        ))
        return rid

    def search(self, query: str, top_k: int = 3) -> list[ArchivalRecord]:
        q_tokens = set(query.lower().split())
        scored: list[tuple[float, ArchivalRecord]] = []
        for record in self._records:
            r_tokens = set(record.text.lower().split())
            if not r_tokens:
                continue
            overlap = len(q_tokens & r_tokens)
            if overlap == 0:
                continue
            score = overlap / (len(q_tokens) + len(r_tokens) - overlap)
            scored.append((score, record))
        scored.sort(key=lambda x: -x[0])
        return [r for _, r in scored[:top_k]]

    def count(self) -> int:
        return len(self._records)


class MemoryTools:
    def __init__(self, main: MainContext, archival: ArchivalStore) -> None:
        self.main = main
        self.archival = archival

    def core_memory_append(self, section: str, text: str) -> str:
        existing = self.main.core.get(section, "")
        self.main.core[section] = (existing + " " + text).strip() if existing else text
        return f"core[{section}] appended: {len(self.main.core[section])} chars"

    def core_memory_replace(self, section: str, old: str, new: str) -> str:
        current = self.main.core.get(section, "")
        if old not in current:
            return f"error: {old!r} not in core[{section}]"
        self.main.core[section] = current.replace(old, new)
        return f"core[{section}] replaced"

    def archival_memory_insert(self, text: str, tags: tuple[str, ...] = ()) -> str:
        rid = self.archival.insert(text, tags=tags)
        return f"stored {rid} ({self.archival.count()} records)"

    def archival_memory_search(self, query: str, top_k: int = 3) -> str:
        hits = self.archival.search(query, top_k=top_k)
        if not hits:
            return "no matches"
        return "\n".join(f"  {h.rid}: {h.text}" for h in hits)

    def conversation_search(self, query: str) -> str:
        q = query.lower()
        for msg in reversed(self.main.evicted + self.main.messages):
            if q in msg.text.lower():
                return f"found ({msg.role}): {msg.text}"
        return "no matches"


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]


def run_scripted_agent(tools: MemoryTools, script: list[ToolCall]) -> list[str]:
    observations: list[str] = []
    for call in script:
        fn = getattr(tools, call.name, None)
        if fn is None:
            observations.append(f"error: unknown tool {call.name!r}")
            continue
        try:
            observations.append(fn(**call.args))
        except Exception as e:
            observations.append(f"error: {type(e).__name__}: {e}")
    return observations


def main() -> None:
    print("=" * 70)
    print("MEMGPT VIRTUAL CONTEXT — Phase 14, Lesson 07")
    print("=" * 70)

    main_ctx = MainContext(max_messages=3)
    archival = ArchivalStore()
    tools = MemoryTools(main_ctx, archival)

    main_ctx.append("user", "my name is ava and I ship agents for a living")
    main_ctx.append("assistant", "noted. what are you building right now?")
    main_ctx.append("user", "a retrieval bot for our sales org, 12 tools so far")
    main_ctx.append("assistant", "12 tools is in the long-horizon band; plan for drift")

    script = [
        ToolCall("core_memory_append",
                 {"section": "persona", "text": "the agent remembers user details politely"}),
        ToolCall("core_memory_append",
                 {"section": "user", "text": "name=ava, role=ships agents"}),
        ToolCall("archival_memory_insert",
                 {"text": "ava is building a retrieval bot with 12 tools for sales",
                  "tags": ("project", "ava")}),
        ToolCall("archival_memory_insert",
                 {"text": "long-horizon tool chains drift after 20 steps per BFCL V4",
                  "tags": ("bfcl", "tools")}),
        ToolCall("archival_memory_insert",
                 {"text": "sleep-time compute consolidates memory asynchronously",
                  "tags": ("letta", "memory")}),
    ]
    observations = run_scripted_agent(tools, script)

    print("\ntool trace (memory writes)")
    for call, obs in zip(script, observations):
        print(f"  {call.name}({call.args}) -> {obs}")

    print("\nfilling main context until eviction kicks in")
    main_ctx.append("user", "what were you saying about tool chains?")
    main_ctx.append("assistant", "let me check archival")

    print(f"\nmain context ({len(main_ctx.messages)} messages, "
          f"{len(main_ctx.evicted)} evicted)")
    print(main_ctx.render())

    print("\npage in: archival_memory_search('tool chains drift')")
    hit = tools.archival_memory_search("tool chains drift", top_k=2)
    print(hit)

    print("\nconversation_search for 'retrieval bot'")
    print(tools.conversation_search("retrieval bot"))

    print()
    print("pattern: memory is interrupt-driven. agent calls a tool, runtime")
    print("fetches, result splices back as observation. same as Unix read().")


if __name__ == "__main__":
    main()
