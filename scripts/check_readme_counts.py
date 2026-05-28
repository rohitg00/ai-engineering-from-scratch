#!/usr/bin/env python3
"""README.md内のハードコードされた件数がcatalog.json totalsと一致するか検証する。

Python 3.10+ が必要。stdlibのみ。

catalog.jsonはファイルシステム上の真実である（scripts/build_catalog.pyで再構築され、
CIで確認される）。一方READMEには、カリキュラムが増減するたびにずれやすい
ハードコード件数（"428 lessons"、"373 skills, 99 prompts, ..."など）が散在する。
このscriptは各ハードコード件数をcatalog.jsonの `totals` ブロックのfieldに固定し、
一致しない場合に失敗する。

使い方:
    python3 scripts/check_readme_counts.py            # driftがあればexit 1
    python3 scripts/check_readme_counts.py --json     # 機械可読レポート
    python3 scripts/check_readme_counts.py --fix      # catalogに合わせてREADMEを書き換え

--fix は明示指定が必要。CIでは--fixなしで実行し、不一致があればbuildを失敗させ、
workflow logにdriftを出す。

patternはREADMEの文脈（badge URL、alt属性、特定の本文）に意図的にanchorしているため、
Contents table内の `<code>22 lessons</code>` のようなフェーズ別件数は触らない。
各patternはcatalog fieldと短い人間向け説明を宣言し、不一致は行番号と周辺テキスト付きで
報告される。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "catalog.json"
README_PATH = ROOT / "README.md"


@dataclass(frozen=True)
class CountPattern:
    """README内の単一ハードコード件数をcatalog totals fieldに固定する。"""

    regex: re.Pattern[str]
    field: str  # totals.<field>
    description: str


PATTERNS: tuple[CountPattern, ...] = (
    CountPattern(
        regex=re.compile(r"lessons-(\d+)-3553ff"),
        field="lessons",
        description="lesson-count badge URL",
    ),
    CountPattern(
        regex=re.compile(r'alt="(\d+) lessons"'),
        field="lessons",
        description="lesson-count badge alt text",
    ),
    CountPattern(
        regex=re.compile(r"^> (\d+) (?:lessons|レッスン)[\.。]\s*\d+ (?:phases|フェーズ)[\.。]", re.MULTILINE),
        field="lessons",
        description="hero blockquote lesson count",
    ),
    CountPattern(
        regex=re.compile(r"^> \d+ (?:lessons|レッスン)[\.。]\s*(\d+) (?:phases|フェーズ)[\.。]", re.MULTILINE),
        field="phases",
        description="hero blockquote phase count",
    ),
    CountPattern(
        regex=re.compile(r"(?:This curriculum is the spine|このカリキュラムは背骨です)[\.。]\s*(\d+) (?:phases|フェーズ)[,、]"),
        field="phases",
        description="'spine' prose phase count",
    ),
    CountPattern(
        regex=re.compile(r"(?:This curriculum is the spine|このカリキュラムは背骨です)[\.。]\s*\d+ (?:phases|フェーズ)[,、]\s*(\d+) (?:lessons|レッスン)[,、]"),
        field="lessons",
        description="'spine' prose lesson count",
    ),
    CountPattern(
        regex=re.compile(r"phases-(\d+)-3553ff"),
        field="phases",
        description="phase-count badge URL",
    ),
    CountPattern(
        regex=re.compile(r'alt="(\d+) phases"'),
        field="phases",
        description="phase-count badge alt text",
    ),
    CountPattern(
        regex=re.compile(r"(?:portfolio of|理解できる)\s+(\d+)\s+(?:artifacts|個の成果物 portfolio)"),
        field="lessons",
        description="'portfolio of N artifacts' (one artifact per lesson)",
    ),
    CountPattern(
        regex=re.compile(r"(?:The repo ships|このリポジトリは).*?(\d+)\s+(?:skills|個の skill)"),
        field="skills",
        description="toolkit section skill count",
    ),
    CountPattern(
        regex=re.compile(r"(?:The repo ships|このリポジトリは).*?\d+\s+(?:skills|個の skill)(?: and| と)\s+(\d+)\s+(?:prompts|個の prompt)"),
        field="prompts",
        description="toolkit section prompt count",
    ),
    CountPattern(
        regex=re.compile(r"MIT[- ]licensed[,、]\s*(\d+)\s+(?:lessons\.|レッスン。)"),
        field="lessons",
        description="sponsor section lesson count",
    ),
)


@dataclass
class Mismatch:
    pattern: CountPattern
    found: int
    expected: int
    line: int
    snippet: str


def load_totals() -> dict[str, int]:
    with CATALOG_PATH.open(encoding="utf-8") as fh:
        catalog = json.load(fh)
    totals = catalog.get("totals")
    if not isinstance(totals, dict):
        raise SystemExit("catalog.json に 'totals' ブロックがありません")
    return totals


def line_for(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def snippet_for(text: str, offset: int, end: int) -> str:
    line_start = text.rfind("\n", 0, offset) + 1
    line_end = text.find("\n", end)
    if line_end == -1:
        line_end = len(text)
    return text[line_start:line_end].strip()


def find_mismatches(readme_text: str, totals: dict[str, int]) -> list[Mismatch]:
    mismatches: list[Mismatch] = []
    for pattern in PATTERNS:
        expected = totals.get(pattern.field)
        if expected is None:
            raise SystemExit(f"catalog.json totals にfieldがありません: {pattern.field}")
        matched_any = False
        for match in pattern.regex.finditer(readme_text):
            matched_any = True
            found = int(match.group(1))
            if found != expected:
                mismatches.append(
                    Mismatch(
                        pattern=pattern,
                        found=found,
                        expected=expected,
                        line=line_for(readme_text, match.start()),
                        snippet=snippet_for(readme_text, match.start(), match.end()),
                    )
                )
        if not matched_any:
            raise SystemExit(
                f"patternがREADMEにまったく一致しません: {pattern.description} "
                f"({pattern.regex.pattern!r}). README構造が変わっています。"
                f"scripts/check_readme_counts.py を更新してください。"
            )
    return mismatches


def apply_fixes(readme_text: str, totals: dict[str, int]) -> str:
    for pattern in PATTERNS:
        expected = totals[pattern.field]

        def replace(match: re.Match[str], expected: int = expected) -> str:
            whole = match.group(0)
            old = match.group(1)
            start = match.start(1) - match.start()
            return whole[:start] + str(expected) + whole[start + len(old):]

        readme_text = pattern.regex.sub(replace, readme_text)
    return readme_text


def render_text_report(mismatches: list[Mismatch]) -> str:
    if not mismatches:
        return "README.md の件数は catalog.json totals と一致しています。\n"
    out = [f"README.md のdriftを検出: {len(mismatches)} 件の不一致。\n"]
    for m in mismatches:
        out.append(
            f"  README.md:{m.line}  {m.pattern.description}\n"
            f"    expected totals.{m.pattern.field} = {m.expected}, found {m.found}\n"
            f"    >>> {m.snippet}\n"
        )
    out.append(
        "\nREADME.mdを更新するには `python3 scripts/check_readme_counts.py --fix` を実行してください。\n"
    )
    return "".join(out)


def render_json_report(mismatches: list[Mismatch], totals: dict[str, int]) -> str:
    payload = {
        "ok": not mismatches,
        "totals": totals,
        "mismatches": [
            {
                "line": m.line,
                "field": m.pattern.field,
                "description": m.pattern.description,
                "expected": m.expected,
                "found": m.found,
                "snippet": m.snippet,
            }
            for m in mismatches
        ],
    }
    return json.dumps(payload, indent=2) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--json", action="store_true", help="JSONレポートをstdoutへ出力")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="ハードコード件数がcatalog.jsonと一致するようREADME.mdを書き換える",
    )
    args = parser.parse_args(argv)

    totals = load_totals()
    readme_text = README_PATH.read_text(encoding="utf-8")

    if args.fix:
        initial_mismatches = find_mismatches(readme_text, totals)
        if not initial_mismatches:
            if args.json:
                sys.stdout.write(render_json_report([], totals))
            else:
                sys.stdout.write("README.md は既に catalog.json totals と一致しています。\n")
            return 0
        new_text = apply_fixes(readme_text, totals)
        README_PATH.write_text(new_text, encoding="utf-8")
        remaining = find_mismatches(new_text, totals)
        if args.json:
            sys.stdout.write(render_json_report(remaining, totals))
        else:
            sys.stdout.write("README.md を catalog.json totals に合わせて更新しました。\n")
            if remaining:
                sys.stdout.write(render_text_report(remaining))
        return 1 if remaining else 0

    mismatches = find_mismatches(readme_text, totals)
    if args.json:
        sys.stdout.write(render_json_report(mismatches, totals))
    else:
        sys.stdout.write(render_text_report(mismatches))
    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
