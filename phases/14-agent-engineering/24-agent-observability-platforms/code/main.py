"""Stdlib trace collector + LLM-judge evaluator.

Mirrors what Langfuse / Phoenix / Opik do with richer UIs: ingest spans,
group by session, score with an LLM judge, surface failure categories.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class SpanEvent:
    trace_id: str
    session_id: str
    name: str
    status: str = "ok"
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass
class SessionSummary:
    session_id: str
    trace_count: int
    error_count: int
    eval_score_mean: float
    failure_reasons: Counter


class TraceCollector:
    def __init__(self) -> None:
        self.spans: list[SpanEvent] = []

    def ingest(self, span: SpanEvent) -> None:
        self.spans.append(span)

    def by_session(self) -> dict[str, list[SpanEvent]]:
        result: dict[str, list[SpanEvent]] = {}
        for span in self.spans:
            result.setdefault(span.session_id, []).append(span)
        return result


def scripted_llm_judge(session_spans: list[SpanEvent]) -> tuple[float, str]:
    errors = sum(1 for s in session_spans if s.status == "error")
    has_tool = any(s.name.startswith("tool_call") for s in session_spans)
    has_final = any(s.attributes.get("gen_ai.output.reference_id")
                    for s in session_spans)
    tokens_over = any(s.attributes.get("tokens", 0) > 2000 for s in session_spans)
    score = 1.0
    if errors:
        score -= 0.4
    if not has_final:
        score -= 0.3
    if not has_tool:
        score -= 0.1
    if tokens_over:
        score -= 0.1
    score = max(0.0, score)
    if score >= 0.8:
        verdict = "PASS"
    elif score >= 0.5:
        verdict = "WARN"
    else:
        verdict = "FAIL"
    return score, verdict


def categorize_failures(session_spans: list[SpanEvent]) -> Counter:
    reasons: Counter = Counter()
    for span in session_spans:
        if span.status != "error":
            continue
        reason = span.attributes.get("error.reason", "unknown")
        reasons[reason] += 1
    return reasons


def summarize(collector: TraceCollector) -> list[SessionSummary]:
    summaries: list[SessionSummary] = []
    for session_id, spans in collector.by_session().items():
        score, _ = scripted_llm_judge(spans)
        summaries.append(SessionSummary(
            session_id=session_id,
            trace_count=len(spans),
            error_count=sum(1 for s in spans if s.status == "error"),
            eval_score_mean=score,
            failure_reasons=categorize_failures(spans),
        ))
    summaries.sort(key=lambda s: s.eval_score_mean)
    return summaries


def main() -> None:
    print("=" * 70)
    print("AGENT OBSERVABILITY PLATFORMS — Phase 14, Lesson 24")
    print("=" * 70)

    collector = TraceCollector()

    ok_spans = [
        SpanEvent("t001", "s001", "invoke_agent",
                  attributes={"gen_ai.provider.name": "anthropic"}),
        SpanEvent("t001", "s001", "chat",
                  attributes={"gen_ai.output.reference_id": "c001",
                              "tokens": 800}),
        SpanEvent("t001", "s001", "tool_call search_tool",
                  attributes={"gen_ai.tool.name": "search_tool"}),
        SpanEvent("t001", "s001", "chat",
                  attributes={"gen_ai.output.reference_id": "c002",
                              "tokens": 400}),
    ]
    err_spans = [
        SpanEvent("t002", "s002", "invoke_agent",
                  attributes={"gen_ai.provider.name": "anthropic"}),
        SpanEvent("t002", "s002", "chat", status="error",
                  attributes={"error.reason": "rate_limited",
                              "tokens": 0}),
    ]
    slow_spans = [
        SpanEvent("t003", "s003", "invoke_agent",
                  attributes={"gen_ai.provider.name": "openai"}),
        SpanEvent("t003", "s003", "chat",
                  attributes={"gen_ai.output.reference_id": "c003",
                              "tokens": 2500}),
    ]

    for span in ok_spans + err_spans + slow_spans:
        collector.ingest(span)

    print("\nsummary per session (what Langfuse/Phoenix/Opik show)")
    for summary in summarize(collector):
        score, verdict = scripted_llm_judge(collector.by_session()[summary.session_id])
        print(f"  {summary.session_id}  verdict={verdict}  score={score:.2f}  "
              f"spans={summary.trace_count}  errors={summary.error_count}")
        if summary.failure_reasons:
            for reason, count in summary.failure_reasons.most_common():
                print(f"    failure: {reason} x{count}")

    total_errors = sum(s.error_count for s in summarize(collector))
    total_sessions = len(collector.by_session())
    print(f"\naggregate: {total_errors} errors across {total_sessions} sessions")
    print()
    print("Langfuse: prompt versions tied to traces.")
    print("Phoenix: RAG relevancy + drift/clustering.")
    print("Opik: optimization + guardrail enforcement.")


if __name__ == "__main__":
    main()
