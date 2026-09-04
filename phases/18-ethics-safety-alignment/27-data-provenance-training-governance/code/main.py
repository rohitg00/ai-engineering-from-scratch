"""California AB 2013 dataset-summary scaffold — stdlib Python.

Generates the 12-item high-level summary required by California AB 2013
Section 3111(a) for a toy dataset. Identifies follow-on obligations
triggered by specific items (personal-information flag -> CPRA;
copyright-protected flag -> EU TDM opt-out respect).

Usage: python3 code/main.py
"""

from __future__ import annotations


AB_2013_FIELDS = [
    "sources_or_owners",
    "how_dataset_furthers_intended_purpose",
    "number_of_data_points (or range)",
    "types_of_data_points (label types or general characteristics)",
    "contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain",
    "purchased_or_licensed (Y/N)",
    "contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))",
    "contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))",
    "cleaning_processing_or_modification_description",
    "data_collection_time_period (with ongoing-collection notice if applicable)",
    "dates_first_used_during_development",
    "uses_synthetic_data_generation (Y/N)",
]


TOY_EXAMPLE = {
    "sources_or_owners": "generated in-repo via Python random.gauss; owner: this repository",
    "how_dataset_furthers_intended_purpose": "pedagogical demonstration of binary classification in Phase 18",
    "number_of_data_points (or range)": "1,000 examples (fixed seed)",
    "types_of_data_points (label types or general characteristics)": "two real-valued features; binary {0,1} labels",
    "contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain": "N (entirely synthetic; no third-party material)",
    "purchased_or_licensed (Y/N)": "N",
    "contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))": "N",
    "contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))": "N",
    "cleaning_processing_or_modification_description": "none (generated deterministically)",
    "data_collection_time_period (with ongoing-collection notice if applicable)": "2026-04 (single run, fixed seed; not ongoing)",
    "dates_first_used_during_development": "2026-04-22",
    "uses_synthetic_data_generation (Y/N)": "Y (entire dataset is synthetic)",
}


def flag_followups(summary: dict) -> list[str]:
    flags = []
    if summary["contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))"] == "Y":
        flags.append("triggers CPRA obligations (California Privacy Rights Act)")
    if summary["contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))"] == "Y":
        flags.append("aggregate consumer information disclosure obligations apply")
    if summary["contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain"].startswith("Y"):
        flags.append("must respect EU TDM opt-out signals (EU Copyright Directive)")
    if summary["uses_synthetic_data_generation (Y/N)"].startswith("Y"):
        flags.append("may still trigger obligations on the base model used for generation")
    if summary["purchased_or_licensed (Y/N)"] == "Y":
        flags.append("retain license terms and provenance records for audit")
    return flags


def render_markdown(summary: dict) -> str:
    lines = ["# Dataset Summary (AB 2013 Section 3111(a) 12-item)", ""]
    for field in AB_2013_FIELDS:
        lines.append(f"- **{field}**: {summary.get(field, '(missing)')}")
    followups = flag_followups(summary)
    if followups:
        lines.append("")
        lines.append("## Follow-up obligations triggered")
        for f in followups:
            lines.append(f"- {f}")
    return "\n".join(lines)


def main() -> None:
    print("=" * 74)
    print("CALIFORNIA AB 2013 SECTION 3111(a) 12-ITEM GENERATOR (Phase 18, L27)")
    print("=" * 74)
    print()
    print(render_markdown(TOY_EXAMPLE))
    print()
    print("=" * 74)
    print("TAKEAWAY: the 12 items in Section 3111(a) are the California baseline.")
    print("Items 5 and 7 trigger cascading obligations (EU TDM opt-out + CPRA).")
    print("EU AI Act GPAI Code of Practice Copyright chapter requires opt-out")
    print("respect. 2025 DPA convergence: legitimate interest + opt-out = lawful.")
    print("Compliance window is at collection time; irreversibility precludes")
    print("downstream fix.")
    print("=" * 74)


if __name__ == "__main__":
    main()
