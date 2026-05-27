"""Frontier safety framework comparison — stdlib Python.

Prints a side-by-side comparison of Anthropic RSP v3.0, OpenAI PF v2, and
DeepMind FSF v3.0 along four axes: tier structure, CBRN threshold, AI R&D
threshold, and competitor-adjustment clause.

Reference-only, no simulation. Primary sources cited inline.

Usage: python3 code/main.py
"""

from __future__ import annotations


LABS = [
    {
        "name": "Anthropic RSP v3.0 (Feb 2026)",
        "tier_structure": "ASL-1 .. ASL-5+; biosafety-level analog",
        "cbrn_threshold": "ASL-3 (activated May 2025)",
        "ai_rd_threshold": "AI R&D-2 + AI R&D-4 (disaggregated v3.0)",
        "adjustment_clause": "yes; peer-ship reduction allowed",
        "safety_case": "required at AI R&D-4 crossing",
    },
    {
        "name": "OpenAI PF v2 (Apr 15, 2025)",
        "tier_structure": "Low / Medium / High / Critical per tracked capability",
        "cbrn_threshold": "High for bio",
        "ai_rd_threshold": "High for AI R&D; Critical definitions pending",
        "adjustment_clause": "yes; Leadership may reduce requirements",
        "safety_case": "Capabilities + Safeguards Reports separately",
    },
    {
        "name": "DeepMind FSF v3.0 (Sep 2025)",
        "tier_structure": "CCL per domain: bio / cyber / ML R&D / manipulation",
        "cbrn_threshold": "Bioweapon Uplift CCL",
        "ai_rd_threshold": "ML R&D Acceleration CCL (v2.0 raised security tier)",
        "adjustment_clause": "yes; added 2025",
        "safety_case": "per-CCL; Deceptive Alignment section added v2.0",
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

    print_row("tier structure", "tier_structure")
    print_row("CBRN threshold", "cbrn_threshold")
    print_row("AI R&D threshold", "ai_rd_threshold")
    print_row("competitor-adjustment clause", "adjustment_clause")
    print_row("safety-case requirement", "safety_case")

    print("\n" + "=" * 78)
    print("TAKEAWAY: structural alignment across the three labs: three tiers of")
    print("frontier capability, CBRN thresholds defined, AI R&D thresholds")
    print("emerging, competitor-adjustment clauses universal. no industry-")
    print("standard terminology. safety cases are the convergent artifact.")
    print("UK AISI, US CAISI, EU AI Office provide the external counterpart.")
    print("=" * 78)


if __name__ == "__main__":
    main()
