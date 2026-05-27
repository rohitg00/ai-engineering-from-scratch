"""Phase 13 Lesson 20 - OTel GenAI span emitter, stdlib only.

Emits spans in an OTLP-JSON-like format to stdout for an agent that:
  - invokes an LLM chat (gen_ai.operation.name = "chat")
  - dispatches two tools (gen_ai.operation.name = "execute_tool")
  - makes one MCP client call (CLIENT span with traceparent propagation)

Content capture (gen_ai.content.prompt / completion) is off by default;
enable by setting OTEL_CAPTURE_CONTENT=1 before running.

Run: python code/main.py
"""

from __future__ import annotations

import json
import os
import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Any


CAPTURE_CONTENT = os.environ.get("OTEL_CAPTURE_CONTENT", "0") == "1"


def _hex(n_bytes: int) -> str:
    return uuid.uuid4().hex[: n_bytes * 2]


@dataclass
class Span:
    name: str
    kind: str  # INTERNAL / CLIENT / SERVER
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    start_ns: int = 0
    end_ns: int = 0
    attrs: dict = field(default_factory=dict)
    events: list[dict] = field(default_factory=list)

    def finish(self) -> None:
        self.end_ns = time.time_ns()

    def add_event(self, name: str, attrs: dict) -> None:
        self.events.append({"time": time.time_ns(), "name": name, "attrs": attrs})

    def to_otlp(self) -> dict:
        return {
            "name": self.name,
            "kind": self.kind,
            "traceId": self.trace_id,
            "spanId": self.span_id,
            "parentSpanId": self.parent_span_id,
            "startTimeUnixNano": self.start_ns,
            "endTimeUnixNano": self.end_ns,
            "attributes": self.attrs,
            "events": self.events,
        }


SPANS: list[Span] = []


def start_span(name: str, kind: str, parent: Span | None = None,
               attrs: dict | None = None) -> Span:
    trace_id = parent.trace_id if parent else _hex(16)
    span = Span(name=name, kind=kind, trace_id=trace_id, span_id=_hex(8),
                parent_span_id=parent.span_id if parent else None,
                start_ns=time.time_ns(), attrs=attrs or {})
    SPANS.append(span)
    return span


def fake_llm_call(span: Span, prompt: str) -> str:
    time.sleep(0.05)
    resp_id = f"resp_{uuid.uuid4().hex[:8]}"
    span.attrs.update({
        "gen_ai.response.id": resp_id,
        "gen_ai.response.model": "gpt-4o-2024-08-06",
        "gen_ai.usage.input_tokens": len(prompt) // 4,
        "gen_ai.usage.output_tokens": random.randint(20, 80),
    })
    if CAPTURE_CONTENT:
        span.add_event("gen_ai.content.prompt", {"content": prompt[:200]})
        span.add_event("gen_ai.content.completion", {"content": "sample completion"})
    return "sample completion"


def fake_tool_execute(span: Span, tool: str, args: dict) -> dict:
    time.sleep(0.03)
    span.attrs.update({
        "gen_ai.tool.name": tool,
        "gen_ai.tool.call.id": f"call_{uuid.uuid4().hex[:8]}",
    })
    return {"content": [{"type": "text", "text": f"{tool} ran with {args}"}]}


def fake_mcp_call(parent: Span, tool: str) -> dict:
    mcp_span = start_span("mcp.call", "CLIENT", parent=parent, attrs={
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": tool,
        "mcp.server": "notes",
        "mcp.transport": "stdio",
        "net.peer.name": "child_process",
    })
    traceparent = f"00-{mcp_span.trace_id}-{mcp_span.span_id}-01"
    mcp_span.attrs["traceparent"] = traceparent
    time.sleep(0.04)
    mcp_span.finish()
    return {"tool": tool, "result": "ok"}


def agent_loop() -> None:
    root = start_span("agent.invoke_agent", "INTERNAL", attrs={
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "research-agent",
        "gen_ai.agent.id": "agent_42",
    })

    llm1 = start_span("llm.chat", "CLIENT", parent=root, attrs={
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "gpt-4o",
    })
    fake_llm_call(llm1, "user wants weather in three cities")
    llm1.finish()

    for city in ("Bengaluru", "Tokyo", "Zurich"):
        tool_span = start_span("tool.execute", "INTERNAL", parent=root, attrs={
            "gen_ai.operation.name": "execute_tool",
        })
        fake_tool_execute(tool_span, "get_weather", {"city": city})
        fake_mcp_call(tool_span, "get_weather")
        tool_span.finish()

    llm2 = start_span("llm.chat", "CLIENT", parent=root, attrs={
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "gpt-4o",
    })
    fake_llm_call(llm2, "synthesize three weather results")
    llm2.finish()

    root.finish()


def main() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 19 - OTEL GENAI SPAN EMITTER")
    print(f"  content capture : {'ON' if CAPTURE_CONTENT else 'off (set OTEL_CAPTURE_CONTENT=1)'}")
    print("=" * 72)

    agent_loop()

    print(f"\nemitted {len(SPANS)} spans across 1 trace")
    print(f"\nOTLP-JSON-shaped spans:\n")
    for span in SPANS:
        summary = {
            "name": span.name,
            "kind": span.kind,
            "trace": span.trace_id[:8] + "...",
            "id": span.span_id[:6] + "...",
            "parent": (span.parent_span_id or "ROOT")[:6],
            "duration_ms": round((span.end_ns - span.start_ns) / 1_000_000, 2),
            "attrs": {k: v for k, v in span.attrs.items() if k.startswith("gen_ai")},
            "events": len(span.events),
        }
        print(json.dumps(summary))

    print("\ntry: OTEL_CAPTURE_CONTENT=1 python code/main.py")


if __name__ == "__main__":
    main()
