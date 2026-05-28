"""Regulatory framework timeline printer — stdlib Python.

EU AI Act、GPAI Code of Practice、Transparency Code、UK AISI rebrand、
US CAISI rebrand、Korean AI Framework Act の milestones を統合 timeline として出力する。

Reference-only; primary sources は docs/en.md で引用している。

Usage: python3 code/main.py
"""

from __future__ import annotations


TIMELINE = [
    ("2024-08-01", "EU AI Act が in force になる"),
    ("2024-12-00", "Korean AI Framework Act が National Assembly で passed"),
    ("2025-01-00", "Korean AI Framework Act が enacted (effective Jan 2026)"),
    ("2025-02-02", "EU AI Act: prohibited practices と AI literacy が適用"),
    ("2025-02-00", "UK AISI が AI Security Institute に rename"),
    ("2025-06-00", "US AISI が CAISI (Center for AI Standards and Innovation) に rename"),
    ("2025-07-10", "GPAI Code of Practice 公開 (3 chapters, 12 commitments)"),
    ("2025-08-02", "EU AI Act: GPAI + governance obligations が適用"),
    ("2025-12-17", "Article 50 Transparency Code の first draft"),
    ("2026-01-00", "Korean AI Framework Act effective"),
    ("2026-03-00", "Transparency Code second draft"),
    ("2026-06-00", "Transparency Code final version"),
    ("2026-08-02", "EU AI Act: full applicability + Article 50 transparency + penalties"),
    ("2027-08-02", "EU AI Act: legacy GPAI + embedded high-risk systems"),
]


def main() -> None:
    print("=" * 78)
    print("AI REGULATORY TIMELINE (Phase 18, Lesson 24)")
    print("=" * 78)
    for date, event in TIMELINE:
        print(f"  {date}  {event}")
    print("\n" + "=" * 78)
    print("TAKEAWAY: EU AI Act は global bar を設定する。full enforcement は 2026年8月。")
    print("UK は frontier security に狭まった。US は pro-growth に pivot した。Korea は")
    print("最初の Asian comprehensive framework である。複数 jurisdictions の deployers は、")
    print("通常 EU である最も strict な rule に comply する。")
    print("=" * 78)


if __name__ == "__main__":
    main()
