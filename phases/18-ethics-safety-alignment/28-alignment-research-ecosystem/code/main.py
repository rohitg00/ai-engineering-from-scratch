"""Alignment research ecosystem map — stdlib Python.

2026年の non-lab alignment research layer について、canonical outputs と
cross-references を含む compact map を出力する。

Usage: python3 code/main.py
"""

from __future__ import annotations


ECOSYSTEM = [
    {
        "org": "MATS",
        "full_name": "ML Alignment & Theory Scholars",
        "scale": "2021年以降 527+ researchers、180+ papers、h-index 47",
        "role": "talent pipeline + mentorship program",
        "canonical_output": "90 scholars x 10-12 week cohorts -> labs and external evaluators",
    },
    {
        "org": "Redwood",
        "full_name": "Redwood Research",
        "scale": "Buck Shlegeris が founded。applied alignment lab",
        "role": "AI Control agenda。UK AISI partner",
        "canonical_output": "Greenblatt, Shlegeris et al. AI Control (ICML 2024)",
    },
    {
        "org": "Apollo",
        "full_name": "Apollo Research",
        "scale": "frontier labs の pre-deployment scheming evaluations",
        "role": "three-pillar scheming decomposition",
        "canonical_output": "Meinke et al. In-Context Scheming (arXiv:2412.04984)",
    },
    {
        "org": "METR",
        "full_name": "Model Evaluation and Threat Research",
        "scale": "task-horizon evals。framework synthesis",
        "role": "external cross-lab comparison",
        "canonical_output": "Common Elements of Frontier AI Safety Policies (2025)",
    },
    {
        "org": "Eleos",
        "full_name": "Eleos AI Research",
        "scale": "model-welfare pre-deployment evaluations",
        "role": "welfare methodology check",
        "canonical_output": "Claude Opus 4 welfare assessment (system card 5.3)",
    },
]


def main() -> None:
    print("=" * 78)
    print("ALIGNMENT RESEARCH ECOSYSTEM (Phase 18, Lesson 28)")
    print("=" * 78)
    for org in ECOSYSTEM:
        print(f"\n{org['org']} ({org['full_name']})")
        print(f"  scale             : {org['scale']}")
        print(f"  role              : {org['role']}")
        print(f"  canonical output  : {org['canonical_output']}")

    print("\n" + "=" * 78)
    print("TAKEAWAY: external evaluation は structural credibility を提供する。")
    print("lab-internal evaluations だけでは conflict of interest がある。")
    print("multi-org publications (例: Apollo + OpenAI, Redwood + Anthropic) が")
    print("quality control である。MATS は talent pipeline。UK AISI / CAISI は")
    print("regulatory counterparts である (Lesson 24)。")
    print("=" * 78)


if __name__ == "__main__":
    main()
