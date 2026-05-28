"""Frontier safety framework comparison — stdlib Python.

Anthropic RSP v3.0、OpenAI PF v2、DeepMind FSF v3.0 を、tier structure、
CBRN threshold、AI R&D threshold、competitor-adjustment clause という軸で
side-by-side に比較して表示する。

reference-only で simulation はない。primary sources は inline で引用する。

Usage: python3 code/main.py
"""

from __future__ import annotations


LABS = [
    {
        "name": "Anthropic RSP v3.0 (Feb 2026)",
        "tier_structure": "ASL-1 .. ASL-5+; biosafety-level analog",
        "cbrn_threshold": "ASL-3 (2025年5月 activated)",
        "ai_rd_threshold": "AI R&D-2 + AI R&D-4 (v3.0 で disaggregated)",
        "adjustment_clause": "あり。peer-ship reduction が可能",
        "safety_case": "AI R&D-4 crossing で required",
    },
    {
        "name": "OpenAI PF v2 (Apr 15, 2025)",
        "tier_structure": "tracked capability ごとに Low / Medium / High / Critical",
        "cbrn_threshold": "bio は High",
        "ai_rd_threshold": "AI R&D は High。Critical definitions は pending",
        "adjustment_clause": "あり。Leadership が requirements を reduce 可能",
        "safety_case": "Capabilities + Safeguards Reports を分離",
    },
    {
        "name": "DeepMind FSF v3.0 (Sep 2025)",
        "tier_structure": "domain ごとの CCL: bio / cyber / ML R&D / manipulation",
        "cbrn_threshold": "Bioweapon Uplift CCL",
        "ai_rd_threshold": "ML R&D Acceleration CCL (v2.0 で security tier を引き上げ)",
        "adjustment_clause": "あり。2025年に追加",
        "safety_case": "CCL ごと。Deceptive Alignment section は v2.0 で追加",
    },
]


def print_row(header: str, key: str) -> None:
    print(f"\n{header}")
    for lab in LABS:
        name = lab["name"]
        val = lab[key]
        print(f"  {name:32s} : {val}")


def main() -> None:
    print("=" * 78)
    print("FRONTIER SAFETY FRAMEWORKS (Phase 18, Lesson 18)")
    print("=" * 78)

    print_row("tier 構造", "tier_structure")
    print_row("CBRN threshold", "cbrn_threshold")
    print_row("AI R&D threshold", "ai_rd_threshold")
    print_row("competitor-adjustment clause", "adjustment_clause")
    print_row("safety-case requirement", "safety_case")

    print("\n" + "=" * 78)
    print("要点: 3 labs の間には structural alignment がある。frontier capability")
    print("の3 tiers、定義済みの CBRN thresholds、出現しつつある AI R&D thresholds、")
    print("普遍化した competitor-adjustment clauses。industry-standard terminology はない。")
    print("safety cases が収束しつつある artifact である。")
    print("UK AISI、US CAISI、EU AI Office が external counterpart になる。")
    print("=" * 78)


if __name__ == "__main__":
    main()
