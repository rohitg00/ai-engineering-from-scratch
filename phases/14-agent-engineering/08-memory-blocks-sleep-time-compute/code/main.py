"""Letta-shaped memory blocks with a sleep-time consolidation agent.

Primary agent writes raw facts during turns. Sleep-time agent runs between
turns, off the critical path, and consolidates blocks. Scripted so it runs
offline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Block:
    label: str
    value: str = ""
    limit: int = 300
    description: str = ""
    version: int = 0
    history: list[str] = field(default_factory=list)

    def append(self, text: str) -> str:
        old = self.value
        self.value = (self.value + " " + text).strip() if self.value else text
        self.version += 1
        self.history.append(old)
        return f"{self.label} v{self.version} ({len(self.value)}/{self.limit})"

    def replace(self, old: str, new: str) -> str:
        if old not in self.value:
            return f"error: {old!r} not in {self.label}"
        prev = self.value
        self.value = self.value.replace(old, new)
        self.version += 1
        self.history.append(prev)
        return f"{self.label} v{self.version} replaced"

    def rewrite(self, new: str) -> str:
        prev = self.value
        self.value = new
        self.version += 1
        self.history.append(prev)
        return f"{self.label} v{self.version} rewritten ({len(self.value)}/{self.limit})"

    def near_limit(self, threshold: float = 0.8) -> bool:
        return len(self.value) >= int(self.limit * threshold)


class BlockStore:
    def __init__(self) -> None:
        self._blocks: dict[str, Block] = {}

    def create(self, label: str, description: str, limit: int = 300) -> Block:
        block = Block(label=label, description=description, limit=limit)
        self._blocks[label] = block
        return block

    def get(self, label: str) -> Block | None:
        return self._blocks.get(label)

    def labels(self) -> list[str]:
        return sorted(self._blocks)

    def render(self) -> str:
        lines: list[str] = []
        for label in self.labels():
            block = self._blocks[label]
            lines.append(f"[{block.label} v{block.version} "
                         f"{len(block.value)}/{block.limit}]")
            lines.append(f"  {block.value}")
        return "\n".join(lines)


@dataclass
class ArchivalRecord:
    rid: str
    text: str
    valid: bool = True


class Archival:
    def __init__(self) -> None:
        self._records: list[ArchivalRecord] = []
        self._counter = 0

    def insert(self, text: str) -> str:
        self._counter += 1
        rid = f"a{self._counter:03d}"
        self._records.append(ArchivalRecord(rid=rid, text=text))
        return rid

    def invalidate(self, rid: str) -> bool:
        for record in self._records:
            if record.rid == rid:
                record.valid = False
                return True
        return False

    def valid_records(self) -> list[ArchivalRecord]:
        return [r for r in self._records if r.valid]

    def all_records(self) -> list[ArchivalRecord]:
        return list(self._records)


class PrimaryAgent:
    """Handles turns. Writes raw facts fast; never summarizes or consolidates."""

    def __init__(self, blocks: BlockStore, archival: Archival) -> None:
        self.blocks = blocks
        self.archival = archival
        self.trace: list[str] = []

    def turn(self, user_text: str, writes: list[tuple[str, str, str]]) -> str:
        self.trace.append(f"user: {user_text}")
        for kind, label_or_text, payload in writes:
            if kind == "block_append":
                block = self.blocks.get(label_or_text)
                if block is not None:
                    self.trace.append(f"  block_append -> {block.append(payload)}")
            elif kind == "archival_insert":
                rid = self.archival.insert(payload)
                self.trace.append(f"  archival_insert -> {rid}")
        response = f"response to: {user_text}"
        self.trace.append(f"assistant: {response}")
        return response


class SleepTimeAgent:
    """Off the critical path. Summarizes near-limit blocks, invalidates
    contradicted archival records, no user latency cost.
    """

    def __init__(self, blocks: BlockStore, archival: Archival) -> None:
        self.blocks = blocks
        self.archival = archival
        self.trace: list[str] = []

    def run(self, contradictions: list[tuple[str, str]]) -> None:
        self.trace.append("sleep-time pass start")
        for label in self.blocks.labels():
            block = self.blocks.get(label)
            if block is None:
                continue
            if block.near_limit():
                summary = _summarize(block.value, block.limit // 2)
                result = block.rewrite(summary)
                self.trace.append(f"  consolidate {label}: {result}")
        for claim, reason in contradictions:
            for record in self.archival.all_records():
                if record.valid and claim.lower() in record.text.lower():
                    self.archival.invalidate(record.rid)
                    self.trace.append(
                        f"  invalidate {record.rid} ({reason}): {record.text[:50]}..."
                    )
        self.trace.append("sleep-time pass end")


def _summarize(text: str, target_len: int) -> str:
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    if not sentences:
        return text[:target_len]
    picked: list[str] = []
    total = 0
    for sentence in sentences:
        if total + len(sentence) + 1 > target_len:
            break
        picked.append(sentence)
        total += len(sentence) + 2
    return ". ".join(picked) + "."


def main() -> None:
    print("=" * 70)
    print("LETTA MEMORY BLOCKS + SLEEP-TIME COMPUTE — Phase 14, Lesson 08")
    print("=" * 70)

    blocks = BlockStore()
    blocks.create("human", "facts about the user", limit=180)
    blocks.create("persona", "the agent's self-concept", limit=160)
    blocks.create("task", "the current task scope", limit=220)
    archival = Archival()

    primary = PrimaryAgent(blocks, archival)
    sleep = SleepTimeAgent(blocks, archival)

    primary.turn(
        "my name is ava, I ship agents for a living, I live in Berlin",
        [("block_append", "human", "name=ava role=ships_agents city=Berlin")],
    )
    primary.turn(
        "today help me plan a 30-lesson curriculum on agent engineering",
        [
            ("block_append", "task", "plan 30-lesson agent curriculum, target senior eng"),
            ("archival_insert", "",
             "ava prefers concise, citation-heavy writing over tutorial-style"),
        ],
    )
    primary.turn(
        "I moved to Lisbon last month; update your notes",
        [
            ("block_append", "human", "city=Lisbon (updated from Berlin)"),
            ("archival_insert", "",
             "ava lives in Berlin - old address, outdated"),
        ],
    )
    primary.turn(
        "also the curriculum target is senior and staff engineers, not junior",
        [("block_append", "task",
          "audience=senior+staff eng, cite arXiv and first-party framework docs")],
    )

    print("\nprimary turns (writes are fast and raw)")
    for line in primary.trace:
        print(f"  {line}")

    print("\nblocks after primary phase (pre-consolidation)")
    print(blocks.render())

    sleep.run(contradictions=[
        ("ava lives in Berlin",
         "human block updated city to Lisbon; Berlin archival claim is stale"),
    ])

    print("\nsleep-time trace")
    for line in sleep.trace:
        print(f"  {line}")

    print("\nblocks after sleep-time (consolidated)")
    print(blocks.render())

    print("\narchival state")
    for record in archival.all_records():
        status = "VALID  " if record.valid else "INVALID"
        print(f"  {record.rid} [{status}] {record.text}")

    print()
    print("key property: primary-turn latency is unchanged by consolidation.")
    print("sleep-time can run a stronger, slower model — it is off the path.")


if __name__ == "__main__":
    main()
