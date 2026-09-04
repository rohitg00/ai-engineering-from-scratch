"""Multi-agent AI SRE triage simulator — stdlib Python.

Three specialized agents produce hypotheses; supervisor ranks by agreement.
Adversarial evaluation: disagreement escalates to human.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AgentHypothesis:
    agent: str
    root_cause: str
    confidence: float
    evidence: list[str]


def log_agent(incident: str) -> AgentHypothesis:
    # simulated: scans logs, picks most common error token
    if "checkout" in incident.lower():
        return AgentHypothesis(
            "LogAgent",
            "vLLM OOM from KV cache spike on /api/llm",
            0.78,
            ["frequency: 142 errors/min", "pattern: 'kv_cache_allocation_failed'", "node: pod-gpu-3"],
        )
    return AgentHypothesis("LogAgent", "unclear", 0.35, ["logs show no obvious pattern"])


def metric_agent(incident: str) -> AgentHypothesis:
    # simulated: PromQL query matches to known patterns
    return AgentHypothesis(
        "MetricAgent",
        "GPU memory utilization hit 98% 4 minutes before error spike",
        0.82,
        ["DCGM_FI_DEV_FB_USED >= 97% for 240s", "correlation with error onset: 0.93"],
    )


def runbook_agent(incident: str) -> AgentHypothesis:
    # simulated: vector search on runbook repo
    return AgentHypothesis(
        "RunbookAgent",
        "Matches runbook RB-017: KV cache OOM under burst concurrency",
        0.88,
        ["runbook: RB-017", "last applied: 2026-01-14", "safe action: restart pod + lower --gpu-memory-utilization to 0.85"],
    )


def supervisor(hypotheses: list[AgentHypothesis]) -> dict:
    # group similar root causes; agreement = confidence boost
    root_causes = {}
    for h in hypotheses:
        key = h.root_cause.split(" on ")[0].split(" hit ")[0][:30]
        root_causes.setdefault(key, []).append(h)

    ranked = sorted(root_causes.items(), key=lambda kv: -sum(h.confidence for h in kv[1]))
    top_key, top_agents = ranked[0]
    adversarial_agreement = len(top_agents) >= 2
    action = "restart pod + lower --gpu-memory-utilization"  # safe action

    return {
        "top_root_cause": top_key,
        "supporting_agents": [h.agent for h in top_agents],
        "aggregated_confidence": sum(h.confidence for h in top_agents) / len(top_agents),
        "adversarial_agreement": adversarial_agreement,
        "proposed_action": action,
        "safety_gate": "human approval required" if not adversarial_agreement else "safe action auto-approved",
    }


def main() -> None:
    print("=" * 80)
    print("AI SRE TRIAGE — multi-agent investigation of a production incident")
    print("=" * 80)
    incident = "High error rate in /checkout/generate-summary, last 6 min"
    print(f"\nIncident: {incident}\n")

    hypotheses = [log_agent(incident), metric_agent(incident), runbook_agent(incident)]
    for h in hypotheses:
        print(f"[{h.agent}] confidence={h.confidence:.2f}")
        print(f"  root cause: {h.root_cause}")
        for e in h.evidence:
            print(f"  - {e}")
        print()

    decision = supervisor(hypotheses)
    print("-" * 80)
    print("SUPERVISOR")
    print("-" * 80)
    for k, v in decision.items():
        print(f"  {k}: {v}")

    print("\nNote: the supervisor only proposes narrow safe actions.")
    print("Broad changes (topology, code, IAM) always escalate to a human commander.")


if __name__ == "__main__":
    main()
