#!/usr/bin/env python3
"""Lint zh-Hant translations for Mainland-Chinese technical terms.

The site ships 繁體中文 for Taiwan readers. check_quiz_translations.py (Q009)
already catches Simplified *characters*. That still leaves Mainland *vocabulary*
written in Traditional glyphs: 代碼 instead of 程式碼, 數據 instead of 資料. The
sentence reads as correct Chinese, so a reviewer skims past it, but a Taiwan
reader notices immediately.

Two tiers:

  error  The term is wrong in Taiwan technical writing in every context we have
         seen. `--fix` rewrites these. `--strict` exits 1 when any remain.
  warn   The term is often a Mainland usage but has a legitimate Taiwan meaning
         too (函數 is right in math and wrong for a code function; 質量 means
         mass in physics). Reported for a human to judge. Never auto-fixed.

Scanned: docs/zh.md prose (fenced blocks, inline code, math and link targets are
skipped, since they mirror English), quiz.zh.json strings, and the values of
site/i18n.zh-Hant.js.

Usage:
    python3 scripts/zh_terms.py                 # summary per term
    python3 scripts/zh_terms.py --files         # per-file hit counts
    python3 scripts/zh_terms.py --show 數據     # every line using one term
    python3 scripts/zh_terms.py --fix           # rewrite error-tier terms and headings
    python3 scripts/zh_terms.py --strict        # exit 1 on any error-tier term or heading

Also checked: the recurring `##` sections (The Problem, Build It, Use It, ...)
and the header's **類型：** value must use one standard rendering each
(STANDARD_HEADINGS, TYPE_WORDS). `--fix` applies it.

Stdlib only. Python 3.10+.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Mainland -> Taiwan. Order matters for --fix: longer terms first, so 源代碼
# becomes 原始碼 rather than 源程式碼.
ERROR = {
    "源代碼": "原始碼",
    "數據庫": "資料庫",
    "數據集": "資料集",
    "操作系統": "作業系統",
    "人工智能": "人工智慧",
    "命令行": "命令列",
    "服務器": "伺服器",
    "缺省": "預設",
    "緩存": "快取",
    "鏈接": "連結",
    "用戶": "使用者",
    "示例": "範例 (示意 when it means illustrative)",
    "字符串": "字串",
    "字符": "字元",
    "視頻": "影片",
    "網絡": "網路",
    "信息": "資訊",
    "軟件": "軟體",
    "硬件": "硬體",
    "內存": "記憶體",
    "調試": "除錯",
    "異步": "非同步",
    "隊列": "佇列",
    "線程": "執行緒",
    "屏幕": "螢幕",
    "博客": "部落格",
    "反饋": "回饋",
    "魯棒": "穩健",
}

# Reported, never rewritten: each has a context where it is correct in Taiwan.
WARN = {
    "代碼": "程式碼 for source code; 代碼 is right for an identifier (錯誤代碼, 產品代碼)",
    "數據": "資料; 數據 is acceptable for measured figures (基準數據)",
    "變量": "變數; 單變量 / 多變量 are standard Taiwan statistics terms",
    "運行": "執行; a running total or estimate reads better as 累計 / 移動",
    "默認": "預設 for a default value; 默認 is right for tacit acceptance",
    "函數": "函式 for a code function; 函數 stays for a math function",
    "算法": "演算法",
    "激活": "啟用 / 觸發; 激活函數 is common in Taiwan ML writing too",
    "項目": "專案 for a project; 項目 is right for an item",
    "支持": "支援 for software support; 支持 is right for backing a person or view",
    "調用": "呼叫",
    "循環": "迴圈 for a code loop",
    "文本": "文字 / 文本 (both seen in Taiwan NLP writing)",
    "並發": "並行 / 同時",
    "對象": "物件 for a code object; 對象 is right for a target audience",
    "質量": "品質; 質量 is right for physical mass",
    "優化": "最佳化",
    "登錄": "登入 for sign-in; 登錄 is right for a registry",
    "智能": "智慧 (智能 is acceptable in some product names)",
    "程序": "程式 for a program; 程序 is right for a procedure",
}

# Strings that contain an error-tier term but are correct as a whole: 用戶端 is
# the usual Taiwan word for "client", and 數字符合 is 數字 + 符合, not 字符.
ALLOWED = ("用戶端", "數字符")


def _mask_allowed(text: str) -> str:
    for word in ALLOWED:
        text = text.replace(word, "\0" * len(word))
    return text


SKIP = re.compile(
    r"^```[^\n]*\n.*?^```"          # fenced blocks mirror the English code
    r"|`[^`\n]*`"                   # inline code
    r"|\$\$.*?\$\$|\$[^$\n]+\$"     # math
    r"|\]\([^)\s]*\)",              # link and image targets
    re.M | re.S,
)


def prose(text: str) -> str:
    """Blank out spans the linter must not read, keeping line numbers."""
    return SKIP.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)


def targets(root: Path) -> list[Path]:
    files = sorted(root.glob("phases/*/*/docs/zh.md")) + sorted(root.glob("phases/*/*/quiz.zh.json"))
    dictionary = root / "site" / "i18n.zh-Hant.js"
    return files + ([dictionary] if dictionary.exists() else [])


def scannable(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".md":
        return prose(text)
    if path.name.endswith(".js"):
        # Values only: 'English': '中文'. The English keys hold no CJK anyway.
        return text
    return text


def scan(path: Path, terms: dict) -> list[tuple[int, str, str]]:
    hits = []
    for n, line in enumerate(scannable(path).splitlines(), 1):
        line = _mask_allowed(line)
        for term in terms:
            if term in line:
                hits.extend((n, term, line.strip()) for _ in range(line.count(term)))
    return hits


def fix(path: Path) -> int:
    """Rewrite error-tier terms in prose only, leaving skipped spans byte-identical."""
    text = path.read_text(encoding="utf-8")
    pattern = re.compile("|".join(map(re.escape, ERROR)))
    count = 0

    def rewrite(segment: str) -> str:
        nonlocal count
        masked = _mask_allowed(segment)
        out, last = [], 0
        for m in pattern.finditer(masked):
            out.append(segment[last:m.start()])
            out.append(ERROR[m.group(0)])
            last = m.end()
            count += 1
        out.append(segment[last:])
        return "".join(out)

    if path.suffix == ".md":
        out, last = [], 0
        for m in SKIP.finditer(text):
            out.append(rewrite(text[last:m.start()]))
            out.append(m.group(0))
            last = m.end()
        out.append(rewrite(text[last:]))
        new = "".join(out)
    elif path.suffix == ".json":
        data = json.loads(text)

        def walk(node):
            if isinstance(node, str):
                return rewrite(node)
            if isinstance(node, list):
                return [walk(x) for x in node]
            if isinstance(node, dict):
                return {k: walk(v) for k, v in node.items()}
            return node

        new = json.dumps(walk(data), ensure_ascii=False, indent=2) + "\n"
        if count == 0:
            return 0
    else:
        return 0  # the dictionary is generated or hand-curated; report only
    if count:
        path.write_text(new, encoding="utf-8")
    return count


# The curriculum's recurring `##` sections, one Taiwan rendering each, as
# TRANSLATION-STYLE.md lists them (Pitfalls and Summary from the 2026-11 sync). A reader moving between lessons should meet the same
# signpost every time. Anchors are unaffected: lesson.html derives heading ids
# from the English heading, not from this text.
STANDARD_HEADINGS = {
    "Learning Objectives": "學習目標",
    "The Problem": "問題所在",
    "The Concept": "核心概念",
    "Build It": "動手實作",
    "Use It": "框架應用",
    "Ship It": "產出交付",
    "Exercises": "練習",
    "Key Terms": "關鍵術語",
    "Further Reading": "延伸閱讀",
    "Common Pitfalls": "常見陷阱",
    "Pitfalls": "常見陷阱",
    "Summary": "總結",
}


# The lesson header's **Type:** value, word by word, per TRANSLATION-STYLE.md.
# Capstone is 總結專案 there, in site/i18n.zh-Hant.js and in book/volumes.json.
TYPE_WORDS = {"Build": "實作", "Learn": "學習", "Use": "應用", "Reference": "參考",
              "Capstone": "總結專案", "lab": "實驗"}


def standard_type(english: str) -> str | None:
    """'Learn + Build' -> '學習 + 實作'; None for anything not a plain + list."""
    words = [w.strip() for w in english.split("+")]
    if not all(w in TYPE_WORDS for w in words):
        return None
    return " + ".join(TYPE_WORDS[w] for w in words)


def type_mismatch(zh_path: Path) -> tuple[int, str, str, str] | None:
    """(line, English, current zh, standard zh) when the **類型：** value differs."""
    en_path = zh_path.with_name("en.md")
    if not en_path.exists():
        return None
    en = re.search(r"^\*\*Type:\*\* *(.+?) *$", en_path.read_text(encoding="utf-8"), re.M)
    lines = zh_path.read_text(encoding="utf-8").split("\n")
    for i, line in enumerate(lines):
        m = re.match(r"^\*\*類型：\*\* *(.+?) *$", line)
        if m and en:
            want = standard_type(en.group(1))
            if want and m.group(1) != want:
                return (i + 1, en.group(1), m.group(1), want)
            return None
    return None


def _h2_lines(text: str) -> list[tuple[int, str]]:
    """(line index, heading text) for every `## ` heading outside fences."""
    out, fenced = [], False
    for i, line in enumerate(text.split("\n")):
        if line.startswith("```"):
            fenced = not fenced
        elif not fenced and line.startswith("## "):
            out.append((i, line[3:].strip()))
    return out


def heading_mismatches(zh_path: Path) -> list[tuple[int, str, str, str]]:
    """(line, English, current zh, standard zh) for standard sections whose
    translation differs. Skipped when the heading counts differ: --verify in
    i18n_status.py reports that, and the alignment would be a guess."""
    en_path = zh_path.with_name("en.md")
    if not en_path.exists():
        return []
    en = _h2_lines(en_path.read_text(encoding="utf-8"))
    zh = _h2_lines(zh_path.read_text(encoding="utf-8"))
    if len(en) != len(zh):
        return []
    return [(i + 1, e, z, STANDARD_HEADINGS[e])
            for (_, e), (i, z) in zip(en, zh)
            if e in STANDARD_HEADINGS and z != STANDARD_HEADINGS[e]]


def fix_headings(zh_path: Path) -> int:
    found = heading_mismatches(zh_path)
    kind = type_mismatch(zh_path)
    if not found and not kind:
        return 0
    lines = zh_path.read_text(encoding="utf-8").split("\n")
    for line_no, _, _, standard in found:
        lines[line_no - 1] = f"## {standard}"
    if kind:
        lines[kind[0] - 1] = f"**類型：** {kind[3]}"
    zh_path.write_text("\n".join(lines), encoding="utf-8")
    return len(found) + bool(kind)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--files", action="store_true", help="per-file hit counts")
    ap.add_argument("--show", metavar="TERM", help="print every line containing TERM")
    ap.add_argument("--fix", action="store_true", help="rewrite error-tier terms in place")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any error-tier term remains")
    ap.add_argument("--root", type=Path, default=ROOT, help=argparse.SUPPRESS)
    args = ap.parse_args(argv)

    paths = targets(args.root)
    if args.fix:
        total = 0
        for p in paths:
            n = fix(p)
            if n:
                total += n
                print(f"{n:>4}  {p.relative_to(args.root)}")
        print(f"rewrote {total} error-tier term(s)")
        fixed = sum(fix_headings(p) for p in paths if p.name == "zh.md")
        print(f"standardized {fixed} section heading(s)")

    if args.show:
        for p in paths:
            for n, term, line in scan(p, {args.show: ""}):
                print(f"{p.relative_to(args.root)}:{n}: {line.replace(chr(0), '')[:160]}")
        return 0

    per_term = collections.Counter()
    per_file = collections.Counter()
    files_per_term = collections.defaultdict(set)
    for p in paths:
        for _, term, _ in scan(p, {**ERROR, **WARN}):
            per_term[term] += 1
            per_file[p] += 1
            files_per_term[term].add(p)

    if args.files:
        for p, n in per_file.most_common():
            print(f"{n:>4}  {p.relative_to(args.root)}")
        print()

    errors = {t: n for t, n in per_term.items() if t in ERROR}
    for tier, table in (("error", ERROR), ("warn", WARN)):
        rows = [(t, n) for t, n in per_term.most_common() if t in table]
        for t, n in rows:
            print(f"{tier:<5} {t} -> {table[t]}  ({n} in {len(files_per_term[t])} files)")
    headings = [(p, *h) for p in paths if p.name == "zh.md" for h in heading_mismatches(p)]
    variants = collections.Counter((e, z) for _, _, e, z, _ in headings)
    for (e, z), n in variants.most_common():
        print(f"error heading '## {e}' as '## {z}' -> '## {STANDARD_HEADINGS[e]}'  ({n} files)")
    for p in paths:
        if p.name == "zh.md" and (t := type_mismatch(p)):
            headings.append((p, *t))
            print(f"error type '{t[1]}' as '{t[2]}' -> '{t[3]}'  {p.relative_to(args.root)}")
    print(f"\n{sum(errors.values())} error-tier term(s), {len(headings)} non-standard heading or type label(s), "
          f"{sum(n for t, n in per_term.items() if t in WARN)} warn-tier term(s)")
    return 1 if args.strict and (errors or headings) else 0


if __name__ == "__main__":
    sys.exit(main())
