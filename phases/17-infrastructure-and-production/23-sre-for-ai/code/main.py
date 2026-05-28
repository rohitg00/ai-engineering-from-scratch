"""Multi-agent AI SRE triage simulator — 標準ライブラリのみの Python。

3 つの specialized agents が hypotheses を作り、supervisor が agreement で順位づけします。
Adversarial evaluation: 不一致なら人間へ escalate します。
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
    # シミュレーション: logs を scan し、最も多い error token を選ぶ
    if "checkout" in incident.lower():
        return AgentHypothesis(
            "LogAgent",
            "KV cache spike による /api/llm の vLLM OOM",
            0.78,
            ["頻度: 142 errors/min", "pattern: 'kv_cache_allocation_failed'", "node: pod-gpu-3"],
        )
    return AgentHypothesis("LogAgent", "不明", 0.35, ["logs に明確な pattern はない"])


def metric_agent(incident: str) -> AgentHypothesis:
    # シミュレーション: PromQL query を known patterns に照合する
    return AgentHypothesis(
        "MetricAgent",
        "error spike の 4 分前に GPU memory utilization が 98% に到達",
        0.82,
        ["DCGM_FI_DEV_FB_USED >= 97% for 240s", "error onset との correlation: 0.93"],
    )


def runbook_agent(incident: str) -> AgentHypothesis:
    # シミュレーション: runbook repo に対する vector search
    return AgentHypothesis(
        "RunbookAgent",
        "runbook RB-017 に一致: burst concurrency 下の KV cache OOM",
        0.88,
        ["runbook: RB-017", "last applied: 2026-01-14", "safe action: restart pod + lower --gpu-memory-utilization to 0.85"],
    )


def supervisor(hypotheses: list[AgentHypothesis]) -> dict:
    # 似た root causes を group 化する。agreement = confidence boost
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
    print("AI SRE TRIAGE — production incident の multi-agent investigation")
    print("=" * 80)
    incident = "直近 6 分、/checkout/generate-summary の error rate が高い"
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

    print("\nNote: supervisor は狭い safe actions だけを提案します。")
    print("広い変更 (topology, code, IAM) は必ず human commander に escalate します。")


if __name__ == "__main__":
    main()
