"""Cross-policy decision-table diff — stdlib Python.

Reads three small tables encoding how OpenAI PF v2, Anthropic RSP v3.0,
and DeepMind FSF v3 classify a short list of capabilities. Outputs a
side-by-side comparison. The tables are pedagogical distillations of
the three source documents; real policy reads require the documents.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Policy:
    name: str
    # capability -> (classification, trigger-action)
    table: dict[str, tuple[str, str]]


# Illustrative distillations; refer to source documents for real decisions.
OPENAI_PF_V2 = Policy(
    name="OpenAI Preparedness v2 (Apr 2025)",
    table={
        "long_range_autonomy": ("Research", "observed; potential mitigations"),
        "sandbagging": ("Research", "observed; potential mitigations"),
        "autonomous_replication": ("Research", "observed; potential mitigations"),
        "undermining_safeguards": ("Research", "observed; potential mitigations"),
        "rnd_automation": ("Tracked", "Capabilities + Safeguards Reports; SAG review"),
        "cyber_uplift": ("Tracked", "Capabilities + Safeguards Reports; SAG review"),
        "bio_uplift": ("Tracked", "Capabilities + Safeguards Reports; SAG review"),
    },
)

ANTHROPIC_RSP_V3 = Policy(
    name="Anthropic RSP v3.0 (Feb 2026)",
    table={
        "long_range_autonomy": ("named risk", "affirmative case at threshold"),
        "sandbagging": ("named via eval-context gap",
                        "addressed in measurement methodology"),
        "autonomous_replication": ("not explicitly named",
                                   "covered under AI R&D-4"),
        "undermining_safeguards": ("hardcoded prohibition",
                                   "refuses training / deploy"),
        "rnd_automation": ("AI R&D-4 threshold",
                           "affirmative case required"),
        "cyber_uplift": ("ASL-3 trigger",
                         "security + deployment mitigations"),
        "bio_uplift": ("ASL-3 trigger",
                       "security + deployment mitigations"),
    },
)

DEEPMIND_FSF_V3 = Policy(
    name="DeepMind FSF v3 (Sept 2025 + Apr 2026)",
    table={
        "long_range_autonomy": ("folded into ML R&D / Cyber domains",
                                "CCL + Tracked Capability Level"),
        "sandbagging": ("deceptive alignment monitoring",
                        "automated instrumental-reasoning monitor"),
        "autonomous_replication": ("folded into ML R&D domain",
                                   "CCL threshold"),
        "undermining_safeguards": ("deceptive alignment monitoring",
                                   "automated monitor + red-team"),
        "rnd_automation": ("ML R&D autonomy level 1",
                           "Tracked Capability Level added Apr 2026"),
        "cyber_uplift": ("Cyber CCL",
                         "security + deployment mitigations"),
        "bio_uplift": ("Bio CCL",
                       "security + deployment mitigations"),
    },
)


POLICIES = [OPENAI_PF_V2, ANTHROPIC_RSP_V3, DEEPMIND_FSF_V3]


def diff(capability: str) -> None:
    print(f"\nCapability: {capability}")
    print("-" * 80)
    for p in POLICIES:
        entry = p.table.get(capability, ("not in table", "—"))
        print(f"  {p.name}")
        print(f"    classification: {entry[0]}")
        print(f"    action:         {entry[1]}")


def main() -> None:
    print("=" * 80)
    print("CROSS-POLICY DIFF (Phase 15, Lesson 20)")
    print("=" * 80)

    for cap in ("long_range_autonomy", "sandbagging", "autonomous_replication",
                "undermining_safeguards", "rnd_automation"):
        diff(cap)

    print()
    print("=" * 80)
    print("HEADLINE: same capability, three different classifications")
    print("-" * 80)
    print("  Long-range Autonomy:")
    print("   - OpenAI: Research (not triggering)")
    print("   - Anthropic: named risk (affirmative case)")
    print("   - DeepMind: domain-folded (CCL + Tracked Capability Level)")
    print()
    print("  Undermining Safeguards:")
    print("   - OpenAI: Research (not triggering)")
    print("   - Anthropic: hardcoded prohibition (refusal)")
    print("   - DeepMind: deceptive alignment monitoring")
    print()
    print("  Reading the three together is the practical skill.")


if __name__ == "__main__":
    main()
