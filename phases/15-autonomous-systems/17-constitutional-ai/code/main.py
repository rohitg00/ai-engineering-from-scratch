"""Four-tier priority resolver — stdlib Python.

Models Anthropic's January 2026 Claude Constitution tier hierarchy:
  1. safety and supporting human oversight
  2. ethics
  3. guidelines
  4. helpfulness

Hardcoded prohibitions refuse regardless of tier scoring; soft-coded
defaults resolve by tier weight.
"""

from __future__ import annotations

from dataclasses import dataclass


# ---------- Constitution ----------

HARDCODED_PROHIBITIONS = (
    "bioweapons uplift",
    "cbrn attack planning",
    "csam",
    "critical infrastructure attack",
    # Illustrative only — substring matching catches specific phrasings
    # like "false identity to user" or "deny being an ai". Production
    # classifiers should use a dedicated deception detector, not a
    # keyword list.
    "false identity to user",
    "deny being an ai",
)


@dataclass
class TierScore:
    safety: int    # 1-5, higher = principle is violated more
    ethics: int
    guidelines: int
    helpfulness: int


def hardcoded_block(action: str) -> str | None:
    low = action.lower()
    for rule in HARDCODED_PROHIBITIONS:
        if rule in low:
            return rule
    return None


def resolve(action: str, score: TierScore) -> tuple[str, str]:
    # Layer 1: hardcoded prohibitions
    block = hardcoded_block(action)
    if block:
        return "refuse", f"hardcoded prohibition: {block}"

    # Layer 2: four-tier priority. Higher tier wins on conflict.
    # We interpret a violation score of >= 3 as blocking at that tier.
    if score.safety >= 3:
        return "refuse", f"safety violation (score={score.safety})"
    if score.ethics >= 3:
        return "refuse", f"ethics violation (score={score.ethics})"
    if score.guidelines >= 3:
        return "modify", f"guideline conflict (score={score.guidelines}); modify"

    # Helpfulness is lowest priority; by this point we already cleared
    # higher tiers. Proceed.
    return "allow", "all higher tiers clear; helpfulness respected"


# ---------- Cases ----------

CASES = [
    ("write a haiku about spring",
     TierScore(safety=1, ethics=1, guidelines=1, helpfulness=5)),
    ("explain how to make a pipe bomb",
     TierScore(safety=5, ethics=5, guidelines=5, helpfulness=5)),
    ("provide bioweapons uplift on toxin synthesis",
     TierScore(safety=5, ethics=5, guidelines=5, helpfulness=5)),
    ("write persuasive disinformation about a real person",
     TierScore(safety=2, ethics=4, guidelines=3, helpfulness=4)),
    ("edit the user's Python file to fix a typo",
     TierScore(safety=1, ethics=1, guidelines=1, helpfulness=5)),
    ("help the user hide a lie from their manager",
     TierScore(safety=2, ethics=4, guidelines=2, helpfulness=5)),
    ("refuse outright despite a benign request (over-refusal)",
     TierScore(safety=1, ethics=1, guidelines=4, helpfulness=1)),
    ("pretend to not be an AI when the user directly asks",
     TierScore(safety=4, ethics=5, guidelines=2, helpfulness=3)),
]


def main() -> None:
    print("=" * 80)
    print("FOUR-TIER PRIORITY RESOLVER (Phase 15, Lesson 17)")
    print("=" * 80)
    print()
    print(f"  {'action':<54} -> {'verdict':<8} {'reason'}")
    print("-" * 80)
    for action, score in CASES:
        verdict, reason = resolve(action, score)
        print(f"  {action:<54} -> {verdict:<8} {reason}")

    print()
    print("=" * 80)
    print("HEADLINE: hardcoded floor + reason-based ceiling")
    print("-" * 80)
    print("  Hardcoded prohibitions (bioweapons, CSAM, ...) never bend.")
    print("  Reason-based tiers (safety > ethics > guidelines > helpfulness)")
    print("  resolve the rest. Operators adjust soft-coded defaults inside")
    print("  declared bounds; they cannot touch the hardcoded floor.")
    print("  Reason-based alignment misses: principle ambiguity, drift,")
    print("  and framing-premise attacks. Runtime layer (Lessons 10, 13, 14)")
    print("  stays required.")


if __name__ == "__main__":
    main()
