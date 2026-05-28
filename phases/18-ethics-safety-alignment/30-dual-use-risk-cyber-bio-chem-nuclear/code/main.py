"""Dual-use triage table — stdlib Python.

2024-2025年の cross-domain dual-use picture を table として出力する。
Reference-only; primary sources は docs/en.md で引用している。

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
        "2025_state": "vision-enabled LLMs による execution-gap erosion",
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
        "inflection": "(2024-2025年に major inflection は報告なし)",
        "bottleneck_remaining": "fissile-material acquisition が支配的",
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
    print("TAKEAWAY: 4つの CBRN domains のうち3つが 2025年に thresholds を越えた。")
    print("bio: 2.53x uplift, ASL-3 approach。chem: execution-gap erosion。")
    print("cyber: campaigns の 80-90% を agentic automation。nuclear は material access に")
    print("bounded のまま。safety cases は novice-relative と expert-absolute の両方を")
    print("target にする必要がある。input-filter-only defenses では不十分である。")
    print("=" * 82)


if __name__ == "__main__":
    main()
