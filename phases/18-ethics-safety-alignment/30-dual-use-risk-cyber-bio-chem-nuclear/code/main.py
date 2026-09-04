"""Dual-use triage table — stdlib Python.

Prints the 2024-2025 cross-domain dual-use picture as a table.
Reference-only; primary sources cited in docs/en.md.

Usage: python3 code/main.py
"""

from __future__ import annotations


DOMAINS = [
    {
        "domain": "bio",
        "2024_state": "mild uplift",
        "2025_state": "2.53x novice-relative uplift; ASL-3 approach",
        "inflection": "acquisition-phase automation",
        "bottleneck_remaining": "pathogen procurement, biosafety equipment",
    },
    {
        "domain": "chem",
        "2024_state": "mild uplift",
        "2025_state": "execution-gap erosion via vision-enabled LLMs",
        "inflection": "real-time wet-lab protocol correction",
        "bottleneck_remaining": "precursor procurement, specialized equipment",
    },
    {
        "domain": "cyber",
        "2024_state": "code-snippet assistance",
        "2025_state": "80-90% campaign automation (Anthropic Nov 2025)",
        "inflection": "agentic coding workflows",
        "bottleneck_remaining": "4-6 human intervention steps",
    },
    {
        "domain": "nuclear",
        "2024_state": "limited",
        "2025_state": "limited",
        "inflection": "(no major 2024-2025 inflection reported)",
        "bottleneck_remaining": "fissile-material acquisition dominates",
    },
]


def main() -> None:
    print("=" * 82)
    print("2026 DUAL-USE PICTURE (Phase 18, Lesson 30)")
    print("=" * 82)

    for d in DOMAINS:
        print(f"\n{d['domain'].upper()}")
        print(f"  2024 state             : {d['2024_state']}")
        print(f"  2025 state             : {d['2025_state']}")
        print(f"  inflection             : {d['inflection']}")
        print(f"  remaining bottleneck   : {d['bottleneck_remaining']}")

    print("\n" + "=" * 82)
    print("TAKEAWAY: three of four CBRN domains crossed thresholds in 2025.")
    print("bio: 2.53x uplift, ASL-3 approach. chem: execution-gap erosion.")
    print("cyber: agentic automation of 80-90% of campaigns. nuclear remains")
    print("bounded by material access. safety cases must target novice-relative")
    print("AND expert-absolute; input-filter-only defenses do not suffice.")
    print("=" * 82)


if __name__ == "__main__":
    main()
