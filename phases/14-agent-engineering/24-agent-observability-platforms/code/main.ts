// Lesson: Agent Observability: Langfuse, Phoenix, Opik (phase 14 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/24-agent-observability-platforms/docs/en.md
// Run: npx tsx phases/14-agent-engineering/24-agent-observability-platforms/code/main.ts

type Attrs = Record<string, string | number>;

class Counter {
  counts = new Map<string, number>();

  add(key: string, n = 1): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + n);
  }

  get size(): number {
    return this.counts.size;
  }

  mostCommon(): [string, number][] {
    return [...this.counts.entries()].sort((a, b) => b[1] - a[1]);
  }
}

class SpanEvent {
  constructor(
    public traceId: string,
    public sessionId: string,
    public name: string,
    public status = "ok",
    public attributes: Attrs = {},
  ) {}
}

interface SessionSummary {
  sessionId: string;
  traceCount: number;
  errorCount: number;
  evalScoreMean: number;
  failureReasons: Counter;
}

class TraceCollector {
  spans: SpanEvent[] = [];

  ingest(span: SpanEvent): void {
    this.spans.push(span);
  }

  bySession(): Map<string, SpanEvent[]> {
    const result = new Map<string, SpanEvent[]>();
    for (const span of this.spans) {
      let list = result.get(span.sessionId);
      if (list === undefined) {
        list = [];
        result.set(span.sessionId, list);
      }
      list.push(span);
    }
    return result;
  }
}

function scriptedLlmJudge(sessionSpans: SpanEvent[]): [number, string] {
  const errors = sessionSpans.filter((s) => s.status === "error").length;
  const hasTool = sessionSpans.some((s) => s.name.startsWith("tool_call"));
  const hasFinal = sessionSpans.some((s) => Boolean(s.attributes["gen_ai.output.reference_id"]));
  const tokensOver = sessionSpans.some((s) => ((s.attributes.tokens as number | undefined) ?? 0) > 2000);
  let score = 1.0;
  if (errors) score -= 0.4;
  if (!hasFinal) score -= 0.3;
  if (!hasTool) score -= 0.1;
  if (tokensOver) score -= 0.1;
  score = Math.max(0.0, score);
  let verdict: string;
  if (score >= 0.8) verdict = "PASS";
  else if (score >= 0.5) verdict = "WARN";
  else verdict = "FAIL";
  return [score, verdict];
}

function categorizeFailures(sessionSpans: SpanEvent[]): Counter {
  const reasons = new Counter();
  for (const span of sessionSpans) {
    if (span.status !== "error") continue;
    const reason = (span.attributes["error.reason"] as string | undefined) ?? "unknown";
    reasons.add(reason);
  }
  return reasons;
}

function summarize(collector: TraceCollector): SessionSummary[] {
  const summaries: SessionSummary[] = [];
  for (const [sessionId, spans] of collector.bySession()) {
    const [score] = scriptedLlmJudge(spans);
    summaries.push({
      sessionId,
      traceCount: spans.length,
      errorCount: spans.filter((s) => s.status === "error").length,
      evalScoreMean: score,
      failureReasons: categorizeFailures(spans),
    });
  }
  summaries.sort((a, b) => a.evalScoreMean - b.evalScoreMean);
  return summaries;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("AGENT OBSERVABILITY PLATFORMS: Phase 14, Lesson 24");
  console.log("=".repeat(70));

  const collector = new TraceCollector();

  const okSpans = [
    new SpanEvent("t001", "s001", "invoke_agent", "ok", { "gen_ai.provider.name": "anthropic" }),
    new SpanEvent("t001", "s001", "chat", "ok", { "gen_ai.output.reference_id": "c001", tokens: 800 }),
    new SpanEvent("t001", "s001", "tool_call search_tool", "ok", { "gen_ai.tool.name": "search_tool" }),
    new SpanEvent("t001", "s001", "chat", "ok", { "gen_ai.output.reference_id": "c002", tokens: 400 }),
  ];
  const errSpans = [
    new SpanEvent("t002", "s002", "invoke_agent", "ok", { "gen_ai.provider.name": "anthropic" }),
    new SpanEvent("t002", "s002", "chat", "error", { "error.reason": "rate_limited", tokens: 0 }),
  ];
  const slowSpans = [
    new SpanEvent("t003", "s003", "invoke_agent", "ok", { "gen_ai.provider.name": "openai" }),
    new SpanEvent("t003", "s003", "chat", "ok", { "gen_ai.output.reference_id": "c003", tokens: 2500 }),
  ];

  for (const span of [...okSpans, ...errSpans, ...slowSpans]) collector.ingest(span);

  console.log("\nsummary per session (what Langfuse/Phoenix/Opik show)");
  for (const summary of summarize(collector)) {
    const [score, verdict] = scriptedLlmJudge(collector.bySession().get(summary.sessionId)!);
    console.log(
      `  ${summary.sessionId}  verdict=${verdict}  score=${score.toFixed(2)}  ` +
        `spans=${summary.traceCount}  errors=${summary.errorCount}`,
    );
    if (summary.failureReasons.size > 0) {
      for (const [reason, count] of summary.failureReasons.mostCommon()) {
        console.log(`    failure: ${reason} x${count}`);
      }
    }
  }

  const totalErrors = summarize(collector).reduce((acc, s) => acc + s.errorCount, 0);
  const totalSessions = collector.bySession().size;
  console.log(`\naggregate: ${totalErrors} errors across ${totalSessions} sessions`);
  console.log();
  console.log("Langfuse: prompt versions tied to traces.");
  console.log("Phoenix: RAG relevancy + drift/clustering.");
  console.log("Opik: optimization + guardrail enforcement.");
}

main();
