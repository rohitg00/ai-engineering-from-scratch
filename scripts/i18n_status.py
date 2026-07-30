#!/usr/bin/env python3
"""Report lesson-translation coverage, derived from the filesystem.

A lesson counts as translated when `docs/<lang>.md` sits beside its `docs/en.md`.
Nothing here is hand-maintained: a checklist committed as prose would drift from
the files the moment a translation landed, so progress is always recomputed from
what is actually on disk.

Usage:
    python3 scripts/i18n_status.py                  # per-phase table + totals
    python3 scripts/i18n_status.py --lang ja        # another target language
    python3 scripts/i18n_status.py --phase 7        # one phase, lesson by lesson
    python3 scripts/i18n_status.py --next 3         # next N untranslated lessons
    python3 scripts/i18n_status.py --json           # machine-readable
    python3 scripts/i18n_status.py --verify         # structural parity of translations

Stdlib only. Python 3.10+.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES = ROOT / "phases"


def word_count(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8").split())
    except (OSError, UnicodeDecodeError):
        return 0


def shape(text: str) -> dict:
    """Structural fingerprint a translation must reproduce.

    Headings are counted with fenced blocks stripped first: a shell comment like
    `# macOS` inside a ```bash block is not a heading, and counting it as one
    hides a real mismatch behind a coincidence.
    """
    fenced = re.findall(r"^```[^\n]*\n.*?^```", text, re.M | re.S)
    prose = re.sub(r"^```[^\n]*\n.*?^```", "", text, flags=re.M | re.S)
    return {
        "headings": re.findall(r"^(#{1,6}) ", prose, re.M),
        "fences": len(fenced),
        "figures": re.findall(r"^```figure\s*\n\s*([\w-]+)", text, re.M),
        "links": sorted(re.findall(r"\]\((https?://[^)\s]+)\)", text)),
        "images": re.findall(r"!\[[^\]]*\]\(([^)\s]+)\)", text),
        "code": [f.split("\n", 1)[1] for f in fenced],
    }


def verify(lesson_dir: Path, lang: str) -> list[str]:
    en = (lesson_dir / "docs" / "en.md").read_text(encoding="utf-8")
    zh = (lesson_dir / "docs" / f"{lang}.md").read_text(encoding="utf-8")
    a, b = shape(en), shape(zh)
    problems = []
    if a["headings"] != b["headings"]:
        problems.append(f"heading outline differs: en={len(a['headings'])} {lang}={len(b['headings'])}")
    if a["fences"] != b["fences"]:
        problems.append(f"fence count differs: en={a['fences']} {lang}={b['fences']}")
    if a["figures"] != b["figures"]:
        problems.append(f"figure widgets differ: en={a['figures']} {lang}={b['figures']}")
    if a["links"] != b["links"]:
        missing = set(a["links"]) - set(b["links"])
        added = set(b["links"]) - set(a["links"])
        problems.append(f"links differ (missing {len(missing)}, added {len(added)})")
    if a["images"] != b["images"]:
        problems.append(f"image paths differ: en={a['images']} {lang}={b['images']}")
    if a["code"] != b["code"]:
        n = sum(1 for x, y in zip(a["code"], b["code"]) if x != y)
        problems.append(f"code block contents drifted in {n} block(s)")
    return problems


def collect(lang: str) -> list[dict]:
    phases = []
    for phase_dir in sorted(p for p in PHASES.iterdir() if p.is_dir()):
        lessons = []
        for lesson_dir in sorted(d for d in phase_dir.iterdir() if d.is_dir()):
            en = lesson_dir / "docs" / "en.md"
            if not en.exists():
                continue
            lessons.append({
                "slug": lesson_dir.name,
                "path": lesson_dir.relative_to(ROOT).as_posix(),
                "words": word_count(en),
                "translated": (lesson_dir / "docs" / f"{lang}.md").exists(),
            })
        if lessons:
            phases.append({"phase": phase_dir.name, "lessons": lessons})
    return phases


def totals(phases: list[dict]) -> dict:
    lessons = [l for p in phases for l in p["lessons"]]
    done = [l for l in lessons if l["translated"]]
    return {
        "lessons": len(lessons),
        "done": len(done),
        "words": sum(l["words"] for l in lessons),
        "words_done": sum(l["words"] for l in done),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="zh", help="target language code (default: zh)")
    ap.add_argument("--phase", type=int, help="restrict to one phase number")
    ap.add_argument("--next", type=int, metavar="N", help="list the next N untranslated lessons")
    ap.add_argument("--json", action="store_true", help="emit JSON on stdout")
    ap.add_argument("--verify", action="store_true",
                    help="structural parity check of every translated lesson")
    args = ap.parse_args()

    phases = collect(args.lang)
    if args.phase is not None:
        prefix = f"{args.phase:02d}-"
        phases = [p for p in phases if p["phase"].startswith(prefix)]
        if not phases:
            print(f"no phase matching {prefix}*", file=sys.stderr)
            return 1

    if args.verify:
        failed = 0
        checked = 0
        for phase in phases:
            for lesson in phase["lessons"]:
                if not lesson["translated"]:
                    continue
                checked += 1
                problems = verify(ROOT / lesson["path"], args.lang)
                if problems:
                    failed += 1
                    print(f"FAIL {lesson['path']}")
                    for problem in problems:
                        print(f"       {problem}")
        print(f"\n{checked} translated lesson(s) checked, {failed} with problems")
        return 1 if failed else 0

    if args.next:
        pending = [l for p in phases for l in p["lessons"] if not l["translated"]]
        for lesson in pending[: args.next]:
            print(f"{lesson['path']}  ({lesson['words']} words)")
        return 0

    if args.json:
        print(json.dumps({"lang": args.lang, "phases": phases, "totals": totals(phases)},
                         ensure_ascii=False, indent=1))
        return 0

    if args.phase is not None:
        for lesson in phases[0]["lessons"]:
            mark = "x" if lesson["translated"] else " "
            print(f"  [{mark}] {lesson['slug']:52} {lesson['words']:6,} words")
        print()

    print(f"{'phase':40} {'done':>9} {'words done':>22}")
    for p in phases:
        ls = p["lessons"]
        done = [l for l in ls if l["translated"]]
        wd = sum(l["words"] for l in done)
        wt = sum(l["words"] for l in ls)
        pct = f"{wd / wt * 100:5.1f}%" if wt else "    —"
        print(f"{p['phase']:40} {len(done):4}/{len(ls):<4} {wd:9,}/{wt:<9,} {pct}")

    t = totals(phases)
    pct_l = t["done"] / t["lessons"] * 100 if t["lessons"] else 0
    pct_w = t["words_done"] / t["words"] * 100 if t["words"] else 0
    print(f"\n{args.lang}: {t['done']}/{t['lessons']} lessons ({pct_l:.1f}%)  ·  "
          f"{t['words_done']:,}/{t['words']:,} words ({pct_w:.1f}%)  ·  "
          f"{t['words'] - t['words_done']:,} words remaining")
    return 0


if __name__ == "__main__":
    sys.exit(main())
