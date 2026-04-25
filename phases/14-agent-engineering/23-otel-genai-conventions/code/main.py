"""Stdlib span emitter matching OpenTelemetry GenAI semantic conventions.

Emits invoke_agent INTERNAL spans, per-tool spans, chat spans for LLM calls.
Content capture is opt-in: prompts go to an external store, spans carry IDs.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Span:
    name: str
    kind: str = "INTERNAL"
    attributes: dict[str, Any] = field(default_factory=dict)
    children: list["Span"] = field(default_factory=list)
    start_ns: int = 0
    end_ns: int = 0

    @property
    def duration_ms(self) -> float:
        return (self.end_ns - self.start_ns) / 1_000_000


class ExternalContentStore:
    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._counter = 0

    def put(self, content: str) -> str:
        self._counter += 1
        cid = f"content_{self._counter:03d}"
        self._store[cid] = content
        return cid

    def get(self, cid: str) -> str:
        return self._store.get(cid, "")

    def items(self) -> list[tuple[str, str]]:
        return sorted(self._store.items())


class Tracer:
    def __init__(self, capture_inline: bool = False,
                 content_store: ExternalContentStore | None = None) -> None:
        self.root = Span(name="__root__")
        self.stack: list[Span] = [self.root]
        self.capture_inline = capture_inline
        self.content_store = content_store or ExternalContentStore()

    def start_span(self, name: str, kind: str = "INTERNAL",
                   attributes: dict[str, Any] | None = None) -> Span:
        span = Span(name=name, kind=kind, attributes=dict(attributes or {}),
                    start_ns=time.perf_counter_ns())
        self.stack[-1].children.append(span)
        self.stack.append(span)
        return span

    def end_span(self) -> None:
        span = self.stack.pop()
        span.end_ns = time.perf_counter_ns()

    def add_content(self, span: Span, key: str, content: str) -> None:
        if self.capture_inline:
            span.attributes[key] = content[:200]
            return
        cid = self.content_store.put(content)
        span.attributes[f"{key}.reference_id"] = cid


def _scripted_llm(prompt: str) -> str:
    if "search" in prompt.lower():
        return "search_tool(\"agent engineering\")"
    if "result" in prompt.lower():
        return "found 3 sources; drafting answer"
    return "final answer: agents in 2026"


def _search_tool(query: str) -> str:
    return f"[3 sources for {query!r}]"


def main() -> None:
    print("=" * 70)
    print("OTEL GENAI SEMANTIC CONVENTIONS — Phase 14, Lesson 23")
    print("=" * 70)

    tracer = Tracer(capture_inline=False)

    create_agent = tracer.start_span(
        "create_agent research_bot",
        attributes={
            "gen_ai.agent.name": "research_bot",
            "gen_ai.operation.name": "create_agent",
            "gen_ai.provider.name": "anthropic",
        },
    )
    tracer.end_span()

    invoke = tracer.start_span(
        "invoke_agent research_bot",
        attributes={
            "gen_ai.agent.name": "research_bot",
            "gen_ai.operation.name": "invoke_agent",
            "gen_ai.provider.name": "anthropic",
            "gen_ai.request.model": "claude-opus-4-6",
        },
    )

    for turn in range(3):
        chat = tracer.start_span(
            "chat",
            attributes={
                "gen_ai.operation.name": "chat",
                "gen_ai.provider.name": "anthropic",
                "gen_ai.request.model": "claude-opus-4-6",
                "gen_ai.response.model": "claude-opus-4-6",
            },
        )
        prompt = f"turn {turn}: next action please"
        tracer.add_content(chat, "gen_ai.input.messages", prompt)
        output = _scripted_llm(prompt)
        tracer.add_content(chat, "gen_ai.output.messages", output)
        tracer.end_span()

        if "search_tool" in output:
            tool_span = tracer.start_span(
                "tool_call search_tool",
                attributes={
                    "gen_ai.operation.name": "tool_call",
                    "gen_ai.tool.name": "search_tool",
                    "gen_ai.data_source.id": "corpus://mem0/default",
                },
            )
            result = _search_tool("agent engineering")
            tracer.add_content(tool_span, "gen_ai.tool.result", result)
            tracer.end_span()

    tracer.end_span()

    def render(span: Span, indent: int = 0) -> None:
        if span.name == "__root__":
            for child in span.children:
                render(child, indent)
            return
        pad = "  " * indent
        dur = f"{span.duration_ms:.2f}ms" if span.end_ns else "..."
        print(f"{pad}{span.name}  [{span.kind}]  {dur}")
        for key in sorted(span.attributes):
            val = span.attributes[key]
            if isinstance(val, str) and len(val) > 50:
                val = val[:50] + "..."
            print(f"{pad}  {key} = {val!r}")
        for child in span.children:
            render(child, indent + 1)

    print("\nspan tree (GenAI-shaped)")
    render(tracer.root)

    print("\nexternal content store (opt-in references, not inline)")
    for cid, content in tracer.content_store.items():
        print(f"  {cid}: {content[:60]}")

    print()
    print("content NOT captured inline by default. store externally; span")
    print("attributes carry reference IDs. set OTEL_SEMCONV_STABILITY_OPT_IN")
    print("=gen_ai_latest_experimental to pin experimental attribute names.")


if __name__ == "__main__":
    main()
