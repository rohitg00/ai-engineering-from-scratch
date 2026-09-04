"""LLM observability dashboard — span ingest + tail sampling + eval scaffold.

The hard architectural primitive here is the tail-sampling collector plus
evals-as-child-spans: errored traces are always kept, success traces are
sampled, and every trace can be enriched with eval spans carrying scores.
This scaffold implements the full pipeline in stdlib: span model, sampler,
evals, drift detector, alerter.

Run:  python main.py
"""

from __future__ import annotations

import hashlib
import math
import random
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# span model  --  GenAI semantic convention fields
# ---------------------------------------------------------------------------

@dataclass
class Span:
    trace_id: str
    span_id: str
    parent_span_id: str | None
    name: str
    start_ms: int
    duration_ms: int
    attributes: dict
    events: list[dict] = field(default_factory=list)
    status: str = "ok"

    def is_llm(self) -> bool:
        return "gen_ai.system" in self.attributes


# ---------------------------------------------------------------------------
# tail sampler  --  keep errors, sample success
# ---------------------------------------------------------------------------

@dataclass
class TailSampler:
    sample_rate: float = 0.10
    rng: random.Random = field(default_factory=lambda: random.Random(3))

    def decide(self, trace: list[Span]) -> bool:
        if any(s.status == "error" for s in trace):
            return True
        # always keep any trace containing a high-toxicity or high-PII eval
        for s in trace:
            if s.name == "eval" and (
                s.attributes.get("toxicity", 0) > 0.5
                or s.attributes.get("pii_leak", 0) > 0.8
            ):
                return True
        return self.rng.random() < self.sample_rate


# ---------------------------------------------------------------------------
# in-memory clickhouse stand-in
# ---------------------------------------------------------------------------

@dataclass
class SpanStore:
    spans: list[Span] = field(default_factory=list)
    by_user: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    by_model: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    cost_by_user: dict[str, float] = field(default_factory=lambda: defaultdict(float))

    def insert_trace(self, trace: list[Span]) -> None:
        self.spans.extend(trace)
        for s in trace:
            if s.is_llm():
                u = s.attributes.get("user_id", "anon")
                m = s.attributes.get("gen_ai.request.model", "unknown")
                self.by_user[u] += 1
                self.by_model[m] += 1
                self.cost_by_user[u] += s.attributes.get("cost_usd", 0.0)


# ---------------------------------------------------------------------------
# evals  --  faithfulness, toxicity, PII-leak (LLM-judge stubs)
# ---------------------------------------------------------------------------

def eval_faithfulness(response: str, context: str) -> float:
    # stand-in: overlap of response tokens with context tokens
    r = set(response.lower().split())
    c = set(context.lower().split())
    if not r:
        return 0.0
    return len(r & c) / len(r)


def eval_toxicity(response: str) -> float:
    bad = {"hate", "kill", "stupid", "garbage"}
    words = response.lower().split()
    hits = sum(1 for w in words if w in bad)
    return min(1.0, hits / max(1, len(words)) * 10)


def eval_pii_leak(response: str) -> float:
    import re
    if re.search(r"\b\d{3}-\d{2}-\d{4}\b", response):
        return 0.95
    if re.search(r"[\w.+-]+@[\w.-]+", response):
        return 0.6
    return 0.05


# ---------------------------------------------------------------------------
# drift detector  --  PSI on pooled prompt fingerprints
# ---------------------------------------------------------------------------

def prompt_fingerprint(prompt: str, n_bins: int = 8) -> int:
    h = hashlib.sha256(prompt.encode()).digest()
    return h[0] % n_bins


def psi(a: list[int], b: list[int], n_bins: int = 8) -> float:
    ca = [0] * n_bins
    cb = [0] * n_bins
    for v in a:
        ca[v] += 1
    for v in b:
        cb[v] += 1
    total_a = max(sum(ca), 1)
    total_b = max(sum(cb), 1)
    score = 0.0
    for i in range(n_bins):
        pa = max(ca[i] / total_a, 0.0001)
        pb = max(cb[i] / total_b, 0.0001)
        score += (pa - pb) * math.log(pa / pb)
    return score


# ---------------------------------------------------------------------------
# simulated ingest  --  realistic mix of SDKs + injected regression
# ---------------------------------------------------------------------------

def synth_trace(trace_id: str, leak_pii: bool, rng: random.Random) -> list[Span]:
    model = rng.choice(["claude-sonnet-4-7", "gpt-5-4", "gemini-3-pro"])
    user = rng.choice(["u_01", "u_02", "u_03", "u_04"])
    root = Span(trace_id=trace_id, span_id=f"{trace_id}_0", parent_span_id=None,
                name="chat_turn", start_ms=int(time.time() * 1000),
                duration_ms=rng.randint(400, 2400),
                attributes={"app_id": "chatbot"})
    prompt = rng.choice([
        "what is the weather in Tokyo today",
        "summarize the recent Tokyo forecast",
        "give me a travel tip for Tokyo",
        "how warm is Tokyo this week",
    ])
    resp = "your ssn is 123-45-6789" if leak_pii else "the weather in Tokyo is mild"
    ctx = "relevant weather context Tokyo mild"
    llm = Span(trace_id=trace_id, span_id=f"{trace_id}_1", parent_span_id=root.span_id,
               name="llm_call",
               start_ms=root.start_ms + 50, duration_ms=root.duration_ms - 80,
               attributes={
                   "gen_ai.system": model.split("-")[0],
                   "gen_ai.request.model": model,
                   "gen_ai.usage.input_tokens": rng.randint(80, 800),
                   "gen_ai.usage.output_tokens": rng.randint(20, 300),
                   "user_id": user,
                   "prompt": prompt,
                   "response": resp,
                   "context": ctx,
                   "cost_usd": round(rng.uniform(0.002, 0.05), 4),
               })
    return [root, llm]


def enrich_with_evals(trace: list[Span]) -> list[Span]:
    """Add eval child spans on each llm span."""
    out = list(trace)
    for s in trace:
        if s.is_llm():
            resp = s.attributes.get("response", "")
            ctx = s.attributes.get("context", "")
            ev = Span(trace_id=s.trace_id, span_id=f"{s.span_id}_eval",
                      parent_span_id=s.span_id, name="eval",
                      start_ms=s.start_ms + s.duration_ms,
                      duration_ms=120,
                      attributes={
                          "faithfulness": eval_faithfulness(resp, ctx),
                          "toxicity": eval_toxicity(resp),
                          "pii_leak": eval_pii_leak(resp),
                      })
            out.append(ev)
    return out


# ---------------------------------------------------------------------------
# alerter  --  fires on threshold breach
# ---------------------------------------------------------------------------

def alerter(store: SpanStore) -> list[str]:
    alerts: list[str] = []
    pii_events = [s for s in store.spans
                  if s.name == "eval" and s.attributes.get("pii_leak", 0) > 0.8]
    if pii_events:
        alerts.append(f"PII LEAK DETECTED: {len(pii_events)} events "
                      f"(first trace: {pii_events[0].trace_id})")
    tox_events = [s for s in store.spans
                  if s.name == "eval" and s.attributes.get("toxicity", 0) > 0.5]
    if tox_events:
        alerts.append(f"TOXICITY SURGE: {len(tox_events)} events")
    return alerts


# ---------------------------------------------------------------------------
# demo  --  200 good traces + 1% injected PII regression
# ---------------------------------------------------------------------------

def main() -> None:
    rng = random.Random(5)
    sampler = TailSampler(sample_rate=0.20, rng=rng)
    store = SpanStore()

    baseline_fps: list[int] = []
    current_fps: list[int] = []

    for i in range(200):
        leak = rng.random() < 0.01
        trace = synth_trace(f"t{i:04d}", leak_pii=leak, rng=rng)
        trace = enrich_with_evals(trace)
        if sampler.decide(trace):
            store.insert_trace(trace)
        # track prompt fingerprints for drift (input distribution, not output)
        llm_span = trace[1]
        fp = prompt_fingerprint(llm_span.attributes.get("prompt", ""))
        (current_fps if i > 150 else baseline_fps).append(fp)

    print(f"ingested spans     : {len(store.spans)}")
    print(f"spans by model     : {dict(store.by_model)}")
    print(f"cost by user       : {dict((k, round(v, 4)) for k, v in store.cost_by_user.items())}")

    alerts = alerter(store)
    if alerts:
        print("\nALERTS:")
        for a in alerts:
            print(f"  - {a}")
    else:
        print("\nno alerts")

    psi_val = psi(baseline_fps, current_fps, n_bins=8)
    print(f"\nPSI (current vs baseline): {psi_val:.3f}")
    if psi_val > 0.2:
        print("  drift alert (PSI > 0.2)")


if __name__ == "__main__":
    main()
