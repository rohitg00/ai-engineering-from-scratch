#!/usr/bin/env python3
"""Find translated lessons whose English changed after the translation.

`docs/zh.md` carries no record of the English it was translated from, so the
baseline is git history: the last commit that touched `docs/zh.md` (or
`quiz.zh.json`). Every change to `docs/en.md` (or `quiz.json`) after that commit
is drift the translation has not absorbed.

Each drifted hunk is classified:

  math     only the notation changed: `x_1..x_k` became $x_1 \\ldots x_k$.
           Upstream's KaTeX migration produced most of these. The zh page
           still reads correctly but shows code spans where English shows
           typeset math.
  content  the words changed: a corrected claim, a new paragraph, a renamed
           section. The zh page teaches something the English no longer says.

A lesson is `content` if any of its hunks is. Fix content drift first.

The baseline skips commits that touched zh.md without syncing it (a
terminology sweep, a mechanical pass over every file): mark such a commit with
a `Zh-Sync: none` trailer, or it moves the baseline and hides older drift.
Pass --since <rev> to measure from a fixed point instead.

Usage:
    python3 scripts/zh_drift.py                    # summary + lesson table
    python3 scripts/zh_drift.py --kind content     # only lessons with real changes
    python3 scripts/zh_drift.py --phase 7
    python3 scripts/zh_drift.py --diff phases/07-transformers-deep-dive/16-speculative-decoding
    python3 scripts/zh_drift.py --json

Stdlib only. Python 3.10+. Needs full git history (not a shallow clone).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# (translation, source) pairs inside a lesson directory.
PAIRS = (("docs/zh.md", "docs/en.md"), ("quiz.zh.json", "quiz.json"))


def git(*args: str, cwd: Path = ROOT) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=True
    ).stdout


def normalize(text: str) -> str:
    """Strip everything a notation change touches: LaTeX commands, `$`, code
    ticks, spacing, punctuation and symbols like × or …. What survives is the
    letters and digits, which a notation-only edit leaves alone."""
    text = re.sub(r"^```\w*\s*$", "", text, flags=re.M)        # ``` became ```math
    text = re.sub(r"\\(?:begin|end)\{[^}]*\}", "", text)          # \begin{aligned}
    text = re.sub(r"\\([A-Za-z]+)", lambda m: _command(m.group(1)), text)
    text = re.sub(r"_(?:hat|bar|tilde)\b", "", text)       # m_hat became \hat{m}
    text = re.sub(r"\b1e-?(\d+)\b", r"10\1", text)          # 1e-8 became 10^{-8}
    # Plain-text formulas spell Greek out: `beta * m` became $\beta \, m$.
    text = re.sub(r"(?<![A-Za-z])(" + "|".join(GREEK) + r")(?=\d|[^A-Za-z]|$)",
                  lambda m: GREEK[m.group(1)], text)
    # A code span writes Σ or ∑ where LaTeX writes \sum; both drop out.
    text = re.sub(r"[ΣΠ∑∏]", "", text)
    return re.sub(r"[\W_]+", "", text).lower()


# Typesetting commands with no letters of their own in the code-span spelling.
# Anything else (\log, \max, \sqrt) keeps its name: `log p` and $\log p$ match.
LAYOUT = set(
    "text textrm textbf mathrm mathbb mathbf mathcal mathit mathsf operatorname "
    "boldsymbol bm displaystyle limits left right big Big bigg Bigg frac tfrac dfrac "
    "cdot cdots ldots dots vdots ddots times div pm mp mid vert Vert lVert rVert "
    "langle rangle lfloor rfloor lceil rceil le leq ge geq ne neq approx sim simeq "
    "equiv propto to rightarrow leftarrow Rightarrow Leftarrow mapsto gets infty "
    "sum prod int oint partial nabla in notin subset subseteq supset cup cap "
    "forall exists top hat bar tilde vec dot overline underline quad qquad "
    "circ odot otimes oplus star ast prime emptyset setminus land lor neg".split()
)


def _command(name: str) -> str:
    if name in GREEK:
        return GREEK[name]
    return "" if name in LAYOUT else name


# `π_θ` in a code span becomes $\pi_\theta$: the letter survives the change,
# only its spelling moves from Unicode to a LaTeX command.
GREEK = {
    name: chr(code) for name, code in (
        ("alpha", 0x3B1), ("beta", 0x3B2), ("gamma", 0x3B3), ("delta", 0x3B4),
        ("epsilon", 0x3B5), ("varepsilon", 0x3B5), ("zeta", 0x3B6), ("eta", 0x3B7),
        ("theta", 0x3B8), ("iota", 0x3B9), ("kappa", 0x3BA), ("lambda", 0x3BB),
        ("mu", 0x3BC), ("nu", 0x3BD), ("xi", 0x3BE), ("pi", 0x3C0), ("rho", 0x3C1),
        ("sigma", 0x3C3), ("tau", 0x3C4), ("phi", 0x3C6), ("varphi", 0x3C6),
        ("chi", 0x3C7), ("psi", 0x3C8), ("omega", 0x3C9), ("Gamma", 0x393),
        ("Delta", 0x394), ("Theta", 0x398), ("Lambda", 0x39B), ("Pi", 0x3A0),
        ("Sigma", 0x3A3), ("Phi", 0x3A6), ("Psi", 0x3A8), ("Omega", 0x3A9),
    )
}


def hunks(diff: str) -> list[tuple[list[str], list[str]]]:
    out: list[tuple[list[str], list[str]]] = []
    for block in re.split(r"^@@[^\n]*@@[^\n]*\n", diff, flags=re.M)[1:]:
        removed = [l[1:] for l in block.splitlines() if l.startswith("-")]
        added = [l[1:] for l in block.splitlines() if l.startswith("+")]
        out.append((removed, added))
    return out


def classify(diff: str) -> tuple[str, int, int]:
    """(kind, math hunks, content hunks) for a unified diff."""
    math = content = 0
    for removed, added in hunks(diff):
        if normalize("\n".join(removed)) == normalize("\n".join(added)):
            math += 1
        else:
            content += 1
    kind = "content" if content else ("math" if math else "fresh")
    return kind, math, content


# A commit that rewrites zh files without porting their English changes (a
# terminology sweep, a mechanical fence copy) must not become a baseline, or it
# hides every English change before it. New ones carry this trailer in the
# commit message; LEGACY_NO_SYNC lists the ones made before the trailer existed.
NO_SYNC_TRAILER = "Zh-Sync: none"
LEGACY_NO_SYNC = (
    "7d0decc29",  # 2026-11 sync: copied rewritten formula fences only
)


def baseline(rel: str, repo: Path = ROOT) -> str:
    """The last commit that touched a translation and actually synced it."""
    log = git("log", "--format=%H%x00%B%x01", "--", rel, cwd=repo)
    for entry in log.split("\x01"):
        sha, _, body = entry.strip().partition("\x00")
        if not sha:
            continue
        if NO_SYNC_TRAILER in body or sha.startswith(LEGACY_NO_SYNC):
            continue
        return sha
    return ""


def drift(lesson: Path, since: str | None, repo: Path = ROOT) -> list[dict]:
    rows = []
    for translated, source in PAIRS:
        t, s = lesson / translated, lesson / source
        if not (t.exists() and s.exists()):
            continue
        rel_t, rel_s = str(t.relative_to(repo)), str(s.relative_to(repo))
        base = since or baseline(rel_t, repo)
        if not base:
            continue
        diff = git("diff", "-U0", base, "HEAD", "--", rel_s, cwd=repo)
        if not diff:
            continue
        kind, math, content = classify(diff)
        commits = git("log", "--format=%h %s", f"{base}..HEAD", "--", rel_s, cwd=repo)
        changed = sum(1 for l in diff.splitlines()
                      if l[:1] in "+-" and not l.startswith(("+++", "---")))
        rows.append({
            "lesson": str(lesson.relative_to(repo)),
            "file": translated,
            "kind": kind,
            "math_hunks": math,
            "content_hunks": content,
            "lines": changed,
            "base": base[:9],
            "commits": commits.strip().splitlines(),
        })
    return rows


def lessons(repo: Path, phase: int | None) -> list[Path]:
    found = sorted({p.parent.parent for p in (repo / "phases").glob("*/*/docs/zh.md")}
                   | {p.parent for p in (repo / "phases").glob("*/*/quiz.zh.json")})
    if phase is not None:
        found = [p for p in found if p.parent.name.startswith(f"{phase:02d}-")]
    return found


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--phase", type=int)
    ap.add_argument("--kind", choices=["math", "content"])
    ap.add_argument("--since", help="measure drift from this rev instead of each file's last commit")
    ap.add_argument("--diff", metavar="LESSON_DIR", help="print the English diff a lesson's zh.md has not absorbed")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    if args.diff:
        lesson = (ROOT / args.diff).resolve()
        for translated, source in PAIRS:
            t = lesson / translated
            if not t.exists():
                continue
            rel = str(t.relative_to(ROOT))
            base = args.since or baseline(rel)
            print(f"### {source} since {base[:9]} (last change to {translated})")
            print(git("diff", base, "HEAD", "--", str((lesson / source).relative_to(ROOT))) or "(no drift)\n")
        return 0

    rows = [r for l in lessons(ROOT, args.phase) for r in drift(l, args.since)]
    if args.kind:
        rows = [r for r in rows if r["kind"] == args.kind]
    if args.json:
        json.dump(rows, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return 0

    rows.sort(key=lambda r: (r["kind"] != "content", -r["lines"]))
    for r in rows:
        hunks = f"{r['content_hunks']}c/{r['math_hunks']}m"
        print(f"{r['kind']:<8} {r['lines']:>4} lines {hunks:>7}  {r['file']:<13} {r['lesson']}")
    counts = {k: sum(1 for r in rows if r["kind"] == k) for k in ("content", "math")}
    print(f"\n{len(rows)} drifted file(s): {counts['content']} content, {counts['math']} math-notation only"
          f"  (hunks: {sum(r['content_hunks'] for r in rows)} content, {sum(r['math_hunks'] for r in rows)} math)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
