#!/usr/bin/env python3
"""Flag plain-text math in lesson docs that could be written as LaTeX.

Usage:
    python3 scripts/find_plain_math.py                 # per-phase summary
    python3 scripts/find_plain_math.py --list          # every flagged line
    python3 scripts/find_plain_math.py --phase 01      # limit to one phase
    python3 scripts/find_plain_math.py --stray-dollars # money or shell $ that reads as math

The scan skips code spans, LaTeX spans, and fenced blocks with a code language.
Untagged and `text` fences are scanned too, because many lessons keep formulas
in them. Report only; it never edits a file.
"""

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FORMULA_FENCES = {"", "text", "plaintext"}

PATTERNS = [
    ("power", re.compile(r"(?<![\w.])(?:[a-zA-Z]|\d+|\))\^(?:\(|\{|-?\w)")),
    ("sqrt", re.compile(r"\bsqrt\(")),
    ("subscript", re.compile(r"(?<![\w.])[a-zA-Z]_(?:\{|[a-zA-Z0-9]\b|\d+\b)")),
    ("derivative", re.compile(r"\bd[a-zA-Z]{1,3}/d[a-zA-Z]{1,3}\b|∂")),
    ("prime", re.compile(r"\b[a-z]'\([a-z]\)")),
    ("nabla", re.compile(r"\bgrad [a-zA-Z]\b|∇")),
    ("sum-lim", re.compile(r"\b(?:sum|lim|limit|prod)_|∑|∏|\blim\b")),
    ("unicode-op", re.compile(r"[√∈∀∃⋅]")),
]

MATH_SPAN = re.compile(r"(?<![\\$\w])\$(?=[^\s$])(?:\\.|[^$\\\n])+(?<=[^\s\\])\$(?!\w)")
LOOSE_SPAN = re.compile(r"(?<![\\$])\$(?=[^\s$])(?:\\.|[^$\\\n])+?(?<=[^\s\\])\$(?![\d$])")
CODE_SPAN = re.compile(r"`[^`\n]+`")
FENCE = re.compile(r"^\s*(`{3,}|~{3,})\s*([\w+-]*)")


def strip_spans(line):
    line = CODE_SPAN.sub(" ", line)
    line = line.replace("\\$", " ")
    return MATH_SPAN.sub(" ", line)


def scan(path):
    hits = []
    stray = []
    fence = None
    fence_lang = ""
    in_display = False
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        match = FENCE.match(line)
        if fence is None and match:
            fence, fence_lang = match.group(1), match.group(2).lower()
            continue
        if fence is not None:
            closing = line.strip()
            if closing and set(closing) == {fence[0]} and len(closing) >= len(fence):
                fence = None
                continue
            if fence_lang not in FORMULA_FENCES:
                continue
        if line.strip() == "$$":
            in_display = not in_display
            continue
        if in_display:
            continue
        text = strip_spans(line)
        kinds = [name for name, pattern in PATTERNS if pattern.search(text)]
        if kinds:
            hits.append((number, kinds, line.strip(), fence is not None))
        if fence is None:
            plain = CODE_SPAN.sub(" ", line).replace("\\$", " ")
            for span in LOOSE_SPAN.finditer(plain):
                if not looks_like_tex(span.group(0)):
                    stray.append((number, span.group(0)))
    return hits, stray


def looks_like_tex(span):
    body = span[1:-1]
    if re.fullmatch(r"[\d.,]+[kKmMbB]?", body):
        return False
    words = re.findall(r"(?<![\\a-zA-Z])[a-zA-Z]{3,}", re.sub(r"\\text\{[^}]*\}", " ", body))
    return not (body[:1].isdigit() and words)


def lesson_docs(phase=None):
    pattern = f"{phase}*/*/docs/en.md" if phase else "*/*/docs/en.md"
    return sorted((ROOT / "phases").glob(pattern))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--phase", help="two-digit phase prefix, for example 01")
    parser.add_argument("--list", action="store_true", help="print every flagged line")
    parser.add_argument("--stray-dollars", action="store_true", help="print $ pairs that read as math but do not look like TeX")
    args = parser.parse_args()

    per_phase = Counter()
    per_phase_fenced = Counter()
    strays = 0
    for path in lesson_docs(args.phase):
        hits, stray = scan(path)
        phase = path.relative_to(ROOT / "phases").parts[0][:2]
        rel = path.relative_to(ROOT)
        for number, kinds, text, fenced in hits:
            if fenced:
                per_phase_fenced[phase] += 1
            else:
                per_phase[phase] += 1
            if args.list:
                where = "fence" if fenced else "prose"
                print(f"{rel}:{number}: [{where}] [{','.join(kinds)}] {text[:160]}")
        for number, span in stray:
            strays += 1
            if args.stray_dollars:
                print(f"{rel}:{number}: stray $ pair: {span[:120]}")

    phases = sorted(set(per_phase) | set(per_phase_fenced))
    print("phase  prose  formula-fence")
    for phase in phases:
        print(f"{phase}     {per_phase[phase]:5d}  {per_phase_fenced[phase]:5d}")
    print(f"total  {sum(per_phase.values()):5d}  {sum(per_phase_fenced.values()):5d}")
    print(f"stray $ pairs: {strays}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
