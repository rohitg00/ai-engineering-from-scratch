"""Alignment research ecosystem map — stdlib Python.

Prints a compact map of the 2026 non-lab alignment research layer with
canonical outputs and cross-references.

Usage: python3 code/main.py
"""

from __future__ import annotations


ECOSYSTEM = [
    {
        "org": "MATS",
        "full_name": "ML Alignment & Theory Scholars",
        "scale": "527+ researchers since 2021, 180+ papers, h-index 47",
        "role": "talent pipeline + mentorship program",
        "canonical_output": "90 scholars x 10-12 week cohorts -> labs and external evaluators",
    },
    {
        "org": "Redwood",
        "full_name": "Redwood Research",
        "scale": "founded by Buck Shlegeris; applied alignment lab",
        "role": "AI Control agenda; UK AISI partner",
        "canonical_output": "Greenblatt, Shlegeris et al. AI Control (ICML 2024)",
    },
    {
        "org": "Apollo",
        "full_name": "Apollo Research",
        "scale": "pre-deployment scheming evaluations for frontier labs",
        "role": "three-pillar scheming decomposition",
        "canonical_output": "Meinke et al. In-Context Scheming (arXiv:2412.04984)",
    },
    {
        "org": "METR",
        "full_name": "Model Evaluation and Threat Research",
        "scale": "task-horizon evals; framework synthesis",
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
    print("TAKEAWAY: external evaluation provides structural credibility.")
    print("lab-internal evaluations alone have a conflict of interest;")
    print("multi-org publications (e.g., Apollo + OpenAI, Redwood + Anthropic)")
    print("are the quality control. MATS is the talent pipeline. UK AISI / CAISI")
    print("are the regulatory counterparts (Lesson 24).")
    print("=" * 78)


if __name__ == "__main__":
    main()
