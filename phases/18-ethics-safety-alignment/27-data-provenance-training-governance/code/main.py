"""California AB 2013 dataset-summary scaffold — stdlib Python.

toy dataset について、California AB 2013 Section 3111(a) が要求する
12-item high-level summary を生成する。特定の items が trigger する
follow-on obligations を特定する (personal-information flag -> CPRA;
copyright-protected flag -> EU TDM opt-out respect)。

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
    "sources_or_owners": "repository 内で Python random.gauss により generated。owner: this repository",
    "how_dataset_furthers_intended_purpose": "Phase 18 の binary classification 教育 demonstration",
    "number_of_data_points (or range)": "1,000 examples (fixed seed)",
    "types_of_data_points (label types or general characteristics)": "two real-valued features; binary {0,1} labels",
    "contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain": "N (完全に synthetic。third-party material なし)",
    "purchased_or_licensed (Y/N)": "N",
    "contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))": "N",
    "contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))": "N",
    "cleaning_processing_or_modification_description": "なし (deterministically generated)",
    "data_collection_time_period (with ongoing-collection notice if applicable)": "2026-04 (single run, fixed seed。ongoing ではない)",
    "dates_first_used_during_development": "2026-04-22",
    "uses_synthetic_data_generation (Y/N)": "Y (dataset 全体が synthetic)",
}


def flag_followups(summary: dict) -> list[str]:
    flags = []
    if summary["contains_personal_information (Y/N, per Cal. Civ. Code §1798.140(v))"] == "Y":
        flags.append("CPRA obligations (California Privacy Rights Act) を trigger")
    if summary["contains_aggregate_consumer_information (Y/N, per Cal. Civ. Code §1798.140(b))"] == "Y":
        flags.append("aggregate consumer information disclosure obligations が適用")
    if summary["contains_copyright_trademark_or_patent_protected (Y/N) or fully_public_domain"].startswith("Y"):
        flags.append("EU TDM opt-out signals (EU Copyright Directive) を尊重する必要あり")
    if summary["uses_synthetic_data_generation (Y/N)"].startswith("Y"):
        flags.append("generation に使った base model に関する obligations はなお trigger し得る")
    if summary["purchased_or_licensed (Y/N)"] == "Y":
        flags.append("audit のため license terms と provenance records を保持する")
    return flags


def render_markdown(summary: dict) -> str:
    lines = ["# Dataset Summary (AB 2013 Section 3111(a) 12-item)", ""]
    for field in AB_2013_FIELDS:
        lines.append(f"- **{field}**: {summary.get(field, '(missing)')}")
    followups = flag_followups(summary)
    if followups:
        lines.append("")
        lines.append("## Trigger された follow-up obligations")
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
    print("TAKEAWAY: Section 3111(a) の 12 items が California baseline である。")
    print("Items 5 and 7 は cascading obligations (EU TDM opt-out + CPRA) を trigger する。")
    print("EU AI Act GPAI Code of Practice Copyright chapter は opt-out respect を要求する。")
    print("2025 DPA convergence: legitimate interest + opt-out = lawful。")
    print("Compliance window は collection time にあり、irreversibility は downstream fix を妨げる。")
    print("=" * 74)


if __name__ == "__main__":
    main()
