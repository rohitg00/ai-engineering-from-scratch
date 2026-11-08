#!/usr/bin/env python3
"""Assemble course lessons into book volumes and render them with pandoc.

Usage:
    python3 scripts/build_book.py                 # assemble + epub for all volumes
    python3 scripts/build_book.py --volume language
    python3 scripts/build_book.py --pdf           # also render PDF (xelatex)
    python3 scripts/build_book.py --assemble-only # markdown only, no pandoc

The book is deliberately a companion to the repo and the website, not a
replacement. Interactive figures, quizzes, and runnable code stay online;
every chapter ends with the links that take the reader there.
"""

import argparse
import functools
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_catalog import LESSON_DIR_RE, read_h1, slug_to_title  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PHASES = ROOT / "phases"
BUILD = ROOT / "book" / "_build"
DIST = ROOT / "dist" / "book"

CONFIG = json.loads((ROOT / "book" / "volumes.json").read_text(encoding="utf-8"))
SITE = CONFIG["site"].rstrip("/")
REPO = CONFIG["repo"].rstrip("/")

FENCE = re.compile(r"^```")
ASSET_IMG = re.compile(r"\]\(\.\./assets/")
HEADING2 = re.compile(r"^## ")

MERMAID_OK = shutil.which("mmdc") is not None
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]


def lesson_dirs(phase):
    base = PHASES / phase
    if not base.is_dir():
        return []
    return [
        d
        for d in sorted(base.iterdir())
        if d.is_dir() and LESSON_DIR_RE.match(d.name) and (d / "docs" / "en.md").is_file()
    ]


def phase_title(phase):
    return read_h1(PHASES / phase / "README.md") or slug_to_title(phase.split("-", 1)[-1])


def urls_for(phase, lesson):
    rel = f"phases/{phase}/{lesson}"
    return {
        "web": f"{SITE}/lesson?path={rel}",
        "code": f"{REPO}/tree/main/{rel}/code",
        "repo": f"{REPO}/tree/main/{rel}",
    }


def fenced_div(cls, *lines):
    return ["", "::: {." + cls + "}", *lines, ":::", ""]


# Boilerplate the builder injects around the lesson prose. A translated edition
# whose language is missing a key falls back to the English string, so a partial
# translation degrades the same way the site does rather than failing the build.
STRINGS = {
    "zh-Hant": {
        "continue_intro": "**線上繼續。**這一章的活版本有紙本裝不下的東西：",
        "continue_web": "動態互動圖解與網頁版內文：",
        "continue_code": "每一步都能執行的程式碼：",
        "continue_quiz": "章末測驗，在瀏覽器裡即時批改：",
        "continue_trust": "儲存庫的更新速度永遠快過任何一次印刷。當書本與儲存庫說法不一致時，以儲存庫為準。",
        "ship_artifact": "**這一章會交付一個產出。**本課的課程版本會產生一段可重複使用的提示詞或代理程式技能，就放在儲存庫裡，隨時可以安裝：",
        "exercises_code": "起始程式碼與本課的完整實作：",
        "figure_interactive": "**互動圖解：`{fig}`。**這張圖會動。到網頁版看它動起來、拖拉它的控制項：",
        "figure_diagram": "**圖解。**在網頁版即時繪製：",
        "toc_title": "目錄",
        "volume_label": "第 {n} 卷 — {title}：{subtitle}",
        "map_vol": "卷",
        "map_title": "書名",
        "map_phases": "課程階段",
        "part_label": "第 {roman} 部 — {title}",
        "part_note": "*課程階段 {phase}。含動態圖解與測驗的活版本：<{url}>*",
    },
}

# Part headings use the phase name from phases/<phase>/README.md. These match
# site/i18n.zh-Hant.js word for word so the book and the site never disagree;
# the NLP entry differs only because the README H1 uses an em dash where
# data.js uses a colon.
PHASE_TITLES = {
    "zh-Hant": {
        "Setup & Tooling": "環境建置與工具鏈",
        "Math Foundations": "數學基礎",
        "ML Fundamentals": "機器學習基礎",
        "Deep Learning Core": "深度學習核心",
        "Computer Vision": "電腦視覺",
        "NLP — Foundations to Advanced": "自然語言處理：從基礎到進階",
        "Speech & Audio": "語音與音訊",
        "Transformers Deep Dive": "Transformer 深入解析",
        "Generative AI": "生成式 AI",
        "Reinforcement Learning": "強化學習",
        "LLMs from Scratch": "從零打造 LLM",
        "LLM Engineering": "LLM 工程",
        "Multimodal AI": "多模態 AI",
        "Tools & Protocols": "工具與協定",
        "Agent Engineering": "代理程式工程",
        "Autonomous Systems": "自主系統",
        "Multi-Agent & Swarms": "多代理與群體智慧",
        "Infrastructure & Production": "基礎設施與生產環境",
        "Ethics, Safety & Alignment": "倫理、安全與對齊",
        "Capstone Projects": "總結專案",
    },
}


def S(key, **kw):
    """A localized book string, falling back to English."""
    text = STRINGS.get(BOOK_LANG, {}).get(key) or STRINGS["en"][key]
    return text.format(**kw) if kw else text


def vol_title(vol):
    return vol.get("i18n", {}).get(BOOK_LANG, {}).get("title") or vol["title"]


def vol_subtitle(vol):
    return vol.get("i18n", {}).get(BOOK_LANG, {}).get("subtitle") or vol["subtitle"]


STRINGS["en"] = {
    "continue_intro": "**Continue online.** The living edition of this chapter has more than the page can hold:",
    "continue_web": "Animated, interactive figures and the web text:",
    "continue_code": "Runnable code for every step:",
    "continue_quiz": "The chapter quiz, graded in the browser:",
    "continue_trust": "The repository moves faster than any printing. When the book and the repo disagree, trust the repo.",
    "ship_artifact": "**This chapter ships an artifact.** The course version of this lesson produces a reusable prompt or agent skill. It lives in the repository, ready to install:",
    "exercises_code": "Starter code and the lesson's working implementation:",
    "figure_interactive": "**Interactive figure: `{fig}`.** This one moves. Watch it animate and drag its controls in the web edition:",
    "figure_diagram": "**Diagram.** Rendered live in the web edition:",
    "toc_title": "Contents",
    "volume_label": "Volume {n} — {title}: {subtitle}",
    "map_vol": "Vol",
    "map_title": "Title",
    "map_phases": "Course phases",
    "part_label": "Part {roman} — {title}",
    "part_note": "*Course phase {phase}. Live edition with animated figures and quizzes: <{url}>*",
}


def continue_box(u, has_quiz):
    lines = [
        S("continue_intro"),
        "",
        f"- {S('continue_web')} <{u['web']}>",
        f"- {S('continue_code')} <{u['code']}>",
    ]
    if has_quiz:
        lines.append(f"- {S('continue_quiz')} <{u['web']}>")
    lines += ["", S("continue_trust")]
    return fenced_div("continue-online", *lines)


def fence_end(src, i):
    """Index of the line that closes the fence opened at src[i] (len(src) if unclosed)."""
    j = i + 1
    while j < len(src) and src[j].strip() != "```":
        j += 1
    return j


BOOK_LANG = "en"  # set by --lang; selects translated source when available

# Languages whose lesson translations are hand-written and committed to this
# repo, mapped to the docs/<code>.md filename they use. These are read straight
# out of phases/ and take precedence over the machine-translated i18n/<lang>/
# tree, which lives on the `translations` branch and is absent from main.
# Mirrors the DOC_CODE map in site/lesson.html and the convention documented in
# CONTRIBUTING.md, so the book and the site render the same prose.
COMMITTED_DOCS = {"zh-Hant": "zh"}


def _lesson_source(phase, lesson):
    docs = ROOT / "phases" / phase / lesson / "docs"
    en = docs / "en.md"
    if BOOK_LANG == "en":
        return en
    code = COMMITTED_DOCS.get(BOOK_LANG)
    if code and (docs / f"{code}.md").is_file():
        return docs / f"{code}.md"
    tr = ROOT / "i18n" / BOOK_LANG / "phases" / phase / lesson / "docs" / f"{BOOK_LANG}.md"
    if tr.is_file():
        return tr
    return en


def h2_headings(path):
    """The `## ` headings of a lesson, in order, ignoring fenced blocks."""
    out, in_fence = [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence and HEADING2.match(line):
            out.append(line[3:].strip())
    return out


def transform_lesson(phase, lesson_dir):
    lesson = lesson_dir.name
    u = urls_for(phase, lesson)
    has_quiz = (lesson_dir / "quiz.json").is_file()
    source = _lesson_source(phase, lesson)
    src = source.read_text(encoding="utf-8").splitlines()

    # "## Ship It" and "## Exercises" are English section names, so on a
    # translated lesson they never match and both callouts silently vanish.
    # en.md and the translation are required to mirror each other's structure,
    # so the nth `## ` of the translation is the nth `## ` in English -- take
    # the section's identity from that counterpart instead of from its text.
    en_path = ROOT / "phases" / phase / lesson / "docs" / "en.md"
    canon_h2 = h2_headings(en_path) if source != en_path else None
    h2_seen = 0

    out = []
    balanced = True
    i = 0
    while i < len(src):
        line = src[i]

        if FENCE.match(line):
            end = fence_end(src, i)
            if end >= len(src):
                balanced = False
            info = line[3:].strip()
            block = src[i + 1 : end]
            if info == "figure":
                fig_id = block[0].strip() if block else "figure"
                out += fenced_div(
                    "interactive-figure",
                    f"{S('figure_interactive', fig=fig_id)} <{u['web']}>",
                )
            elif info == "mermaid":
                rendered = render_mermaid(block)
                if rendered:
                    out += ["", f"![diagram]({rendered})", ""]
                else:
                    out += fenced_div(
                        "interactive-figure",
                        f"{S('figure_diagram')} <{u['web']}>",
                    )
            else:
                out += src[i : end + 1]
            i = end + 1
            continue

        if HEADING2.match(line):
            # Identify the section by its English counterpart, not its own text.
            section = canon_h2[h2_seen] if canon_h2 and h2_seen < len(canon_h2) else line[3:].strip()
            h2_seen += 1
        else:
            section = None

        if section is not None and section.startswith("Ship It"):
            out += fenced_div(
                "continue-online",
                f"{S('ship_artifact')} <{u['repo']}>",
            )
            i += 1
            while i < len(src):
                if FENCE.match(src[i]):
                    end = fence_end(src, i)
                    if end >= len(src):
                        balanced = False
                    i = end + 1
                    continue
                if HEADING2.match(src[i]):
                    break
                i += 1
            continue

        if section is not None and section.startswith("Exercises"):
            out.append(line)
            out.append("")
            out.append(f"{S('exercises_code')} <{u['code']}>")
            i += 1
            continue

        out.append(ASSET_IMG.sub(f"](phases/{phase}/{lesson}/assets/", line))
        i += 1

    if not balanced:
        raise ValueError(f"unbalanced code fence in {source}")

    out += continue_box(u, has_quiz)
    return out


@functools.lru_cache(maxsize=None)
def font_families():
    if not shutil.which("fc-list"):
        return frozenset()
    r = subprocess.run(["fc-list", ":", "family"], capture_output=True, text=True)
    return frozenset(
        fam.strip() for fam_line in r.stdout.splitlines() for fam in fam_line.split(",")
    )


def pick_font(candidates):
    families = font_families()
    for c in candidates:
        if c in families:
            return c
    return None


def render_mermaid(block):
    if not MERMAID_OK:
        return None
    assets = BUILD / "diagrams"
    assets.mkdir(parents=True, exist_ok=True)
    stem = hashlib.sha1("\n".join(block).encode()).hexdigest()[:16]
    svg = assets / f"{stem}.svg"
    if svg.is_file():
        return str(svg.relative_to(ROOT))
    mmd = assets / f"{stem}.mmd"
    mmd.write_text("\n".join(block), encoding="utf-8")
    try:
        subprocess.run(
            ["mmdc", "-i", str(mmd), "-o", str(svg), "-b", "transparent", "--quiet"],
            check=True, capture_output=True, timeout=60,
        )
        return str(svg.relative_to(ROOT))
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or b"").decode(errors="replace").strip()[:300]
        print(f"warning: mermaid render failed for {mmd.name}: {detail}", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print(f"warning: mermaid render timed out for {mmd.name}", file=sys.stderr)
        return None


@functools.lru_cache(maxsize=None)
def git_date():
    return subprocess.run(
        ["git", "log", "-1", "--format=%cs"], capture_output=True, text=True, cwd=ROOT
    ).stdout.strip()


@functools.lru_cache(maxsize=None)
def git_edition():
    return subprocess.run(
        ["git", "log", "-1", "--format=%cd", "--date=format:%Y.%m"],
        capture_output=True, text=True, cwd=ROOT,
    ).stdout.strip() or "0000.00"


@functools.lru_cache(maxsize=None)
def titlepage_template():
    return (ROOT / "book" / "titlepage.tex").read_text(encoding="utf-8")


def clean_phase_title(raw):
    title = re.sub(r"^Phase\s+\d+\s*[:—-]\s*", "", raw).strip()
    return PHASE_TITLES.get(BOOK_LANG, {}).get(title, title)


# Volume front matter, one template per language. A language without an entry
# gets the English one, matching how STRINGS falls back.
FRONT_MATTER = {
    "en": """# About This Volume {{.unnumbered}}

This is Volume {n} of *{series}*, a six-volume compilation of the open course of the same name. Each volume stands alone; cross-references cite course phase numbers, which map to volumes like this:

{map}

The chapters in this volume come from course phases {phases}. Chapter prerequisites name phases, not volumes; use the table above to translate.

# How to Use This Book {{.unnumbered}}

This volume is one loop of a larger machine, and it works best when you run the whole loop:

1. **Read the chapter here.** The prose, the derivations, and the code walkthroughs are complete on the page.
2. **Run the code from the repository.** Every chapter has a `code/` directory with a working implementation you can run and break: <{repo}>
3. **Open the web edition for what paper cannot do.** Animated figures you can watch and drag, and a quiz per chapter that grades itself: <{site}>

The repository is the living edition. Lessons are updated as the field moves; the book is a snapshot with a version number. When they disagree, the repo is right.

## Learning with an AI {{.unnumbered}}

This course is built to be read by agents as well as people. The machine-readable index of every lesson lives at <{site}/llms.txt>. If you learn with an AI assistant, paste this and go:

> I am working through *{series}, Volume {n}: {title}*. Fetch {site}/llms.txt, find the lesson I name, and act as my tutor: quiz me on its Key Terms, review my solutions to its Exercises, and walk me through its code from the repository.
""",
    "zh-Hant": """# 關於這一卷 {{.unnumbered}}

這是《{series}》的第 {n} 卷，全套共六卷，由同名的開放課程彙編而成。每一卷都可以單獨閱讀；書中的交叉引用標的是課程的階段編號，階段與卷別的對應如下：

{map}

本卷的各章來自課程階段 {phases}。各章的先備條件標的是階段而非卷別，請用上表換算。

# 如何使用這本書 {{.unnumbered}}

這一卷是一台更大機器裡的一圈迴路，把整圈跑完，效果最好：

1. **在這裡讀完該章。**內文、推導與程式碼逐步解說，紙上全都完整。
2. **從儲存庫執行程式碼。**每一章都有一個 `code/` 目錄，裡面是可以執行、也可以拆壞的實作：<{repo}>
3. **打開網頁版，看紙本做不到的事。**可以觀看與拖拉的動態圖解，以及每章一份會自動批改的測驗：<{site}>

儲存庫才是活的版本。課程內容會隨著這個領域推進而更新，書則是帶著版本號的一份快照。兩者說法不一致時，以儲存庫為準。

## 與 AI 一起學 {{.unnumbered}}

這門課在設計上就同時給人與代理程式閱讀。所有單元的機器可讀索引放在 <{site}/llms.txt>。如果你用 AI 助理學習，把下面這段貼過去就能開始：

> 我正在讀《{series}》第 {n} 卷：{title}。請抓取 {site}/llms.txt，找到我指名的那一課，然後當我的家教：用它的關鍵術語考我、檢閱我對它練習題的解答，並帶我讀過儲存庫裡它的程式碼。
""",
}


def series_map(vol):
    rows = []
    for v in CONFIG["volumes"]:
        marker = "**" if v["slug"] == vol["slug"] else ""
        phases = ", ".join(p.split("-")[0] for p in v["phases"])
        rows.append(f"| {marker}{v['number']}{marker} | {marker}{vol_title(v)}{marker} — {vol_subtitle(v)} | {phases} |")
    return "\n".join([
        f"| {S('map_vol')} | {S('map_title')} | {S('map_phases')} |",
        "|-----|-------|---------------|",
    ] + rows)


def how_to_use(vol):
    return FRONT_MATTER.get(BOOK_LANG, FRONT_MATTER["en"]).format(
        n=vol["number"],
        series=CONFIG["series"],
        title=vol_title(vol),
        map=series_map(vol),
        phases=", ".join(p.split("-")[0] for p in vol["phases"]),
        repo=REPO,
        site=SITE,
    )


def assemble(vol):
    BUILD.mkdir(parents=True, exist_ok=True)
    parts = [how_to_use(vol)]
    chapters = 0
    for part_idx, phase in enumerate(vol["phases"]):
        title = clean_phase_title(phase_title(phase))
        parts.append(
            f"\n# {S('part_label', roman=ROMAN[part_idx], title=title)} {{.unnumbered .part}}\n\n"
            + S("part_note", phase=phase.split("-")[0], url=f"{SITE}/catalog.html") + "\n"
        )
        for lesson_dir in lesson_dirs(phase):
            parts.append("\n".join(transform_lesson(phase, lesson_dir)))
            chapters += 1
    text = "\n\n".join(parts)
    md = BUILD / f"{vol['slug']}.md"
    md.write_text(text, encoding="utf-8")
    return md, chapters, len(text.split())


def metadata(vol):
    meta = BUILD / f"{vol['slug']}-meta.yaml"
    meta.write_text(
        "---\n"
        f"title: \"{CONFIG['series']}\"\n"
        f"subtitle: \"{S('volume_label', n=vol['number'], title=vol_title(vol), subtitle=vol_subtitle(vol))}\"\n"
        f"author: \"{CONFIG['author']}\"\n"
        f"lang: {BOOK_LANG}\n"
        f"toc-title: {S('toc_title')}\n"
        "---\n",
        encoding="utf-8",
    )
    return meta


def render(vol, md, chapters, pdf=False):
    DIST.mkdir(parents=True, exist_ok=True)
    meta = metadata(vol)
    suffix = "" if BOOK_LANG == "en" else f"-{BOOK_LANG}"
    epub = DIST / f"aiefs-vol{vol['number']}-{vol['slug']}{suffix}.epub"
    cmd = [
        "pandoc", str(meta), str(md),
        "-o", str(epub),
        "--from", "markdown+fenced_divs",
        "--lua-filter", str(ROOT / "book" / "literal-tokens.lua"),
        "--lua-filter", str(ROOT / "book" / "math-blocks.lua"),
        "--toc", "--toc-depth=1",
        "--top-level-division=chapter",
        "--css", str(ROOT / "book" / "epub.css"),
        "--resource-path", str(ROOT),
        "--metadata", f"date={git_date()}",
    ]
    subprocess.run(cmd, check=True, cwd=ROOT)
    results = [epub]
    if pdf and BOOK_LANG in ("ar", "fa", "ur", "he"):
        # right-to-left scripts need a bidi engine + Arabic/Hebrew fonts that the
        # xelatex theme does not ship; the EPUB (above) handles RTL natively, so
        # skip the PDF rather than emit a broken left-to-right one.
        print(f"note: skipping {BOOK_LANG} PDF for {vol['slug']} (RTL not wired for PDF); EPUB produced", file=sys.stderr)
        pdf = False
    if pdf:
        titlepage = BUILD / f"{vol['slug']}-titlepage.tex"
        titlepage.write_text(
            titlepage_template()
            .replace("@VOLNUM3@", f"{vol['number']:03d}")
            .replace("@EDITION@", git_edition())
            .replace("@ROMAN@", ROMAN[vol["number"] - 1])
            .replace("@TOTALVOL@", ROMAN[len(CONFIG["volumes"]) - 1])
            .replace("@CHAPTERS@", str(chapters))
            .replace("@PHASES@", "\\ \\textperiodcentered\\ ".join(p.split("-")[0] for p in vol["phases"]))
            .replace("@TITLE@", vol_title(vol))
            .replace("@SUBTITLE@", vol_subtitle(vol)),
            encoding="utf-8",
        )
        pdf_out = DIST / f"aiefs-vol{vol['number']}-{vol['slug']}{suffix}.pdf"
        cmd_pdf = [
            "pandoc", str(md),
            "-o", str(pdf_out),
            "--from", "markdown+fenced_divs+autolink_bare_uris",
            "--lua-filter", str(ROOT / "book" / "literal-tokens.lua"),
            "--lua-filter", str(ROOT / "book" / "math-blocks.lua"),
            "--lua-filter", str(ROOT / "book" / "pdf-layout.lua"),
            "--toc", "--toc-depth=1",
            "--top-level-division=chapter",
            "--pdf-engine=xelatex",
            "--columns=40",
            "--resource-path", str(ROOT),
            "--include-in-header", str(ROOT / "book" / "theme.tex"),
            "--include-before-body", str(titlepage),
            "-M", f"title-meta={CONFIG['series']} Volume {vol['number']}: {vol_title(vol)}",
            "-M", "author-meta=aiengineeringfromscratch.com",
            "-M", f"lang={BOOK_LANG}",
            "-V", f"toc-title={S('toc_title')}",
            "-V", "documentclass=book",
            "-V", "classoption=oneside,openany",
            "-V", "geometry=margin=1in",
            "-V", "fontsize=10pt",
        ]
        serif = pick_font(["DejaVu Serif", "STIX Two Text", "Georgia"])
        mono = pick_font(["DejaVu Sans Mono", "Menlo", "Consolas"])
        if serif:
            cmd_pdf += ["-V", f"mainfont={serif}"]
        if mono:
            cmd_pdf += ["-V", f"monofont={mono}"]
        # CJK scripts need a matching font; DejaVu already covers
        # Latin/Cyrillic/Greek/Devanagari for the other languages.
        cjk_candidates = {
            "zh": ["Noto Sans CJK SC", "Noto Serif CJK SC", "Source Han Serif SC"],
            # Traditional needs TC faces: SC glyphs render 門 as 门 and so on,
            # so an SC fallback would quietly Simplify the whole book.
            "zh-TW": ["Noto Sans CJK TC", "Noto Serif CJK TC", "Source Han Serif TC"],
            "zh-Hant": ["Noto Sans CJK TC", "Noto Serif CJK TC", "Source Han Serif TC",
                        "PingFang TC", "Songti TC"],
            "ja": ["Noto Sans CJK JP", "Noto Serif CJK JP", "Source Han Serif JP"],
            "ko": ["Noto Sans CJK KR", "Noto Serif CJK KR", "Source Han Serif KR"],
        }
        if BOOK_LANG in cjk_candidates:
            cjk = pick_font(cjk_candidates[BOOK_LANG])
            if cjk:
                cmd_pdf += ["-V", f"CJKmainfont={cjk}"]
        subprocess.run(cmd_pdf, check=True, cwd=ROOT)
        results.append(pdf_out)
    return results


def check_phases():
    claimed = set()
    for vol in CONFIG["volumes"]:
        for phase in vol["phases"]:
            claimed.add(phase)
            if not (PHASES / phase).is_dir() or not lesson_dirs(phase):
                sys.exit(f"volume {vol['slug']}: phase {phase} is missing or has no lessons")
    for d in sorted(PHASES.iterdir()):
        if d.is_dir() and d.name not in claimed:
            print(f"warning: phase directory {d.name} is not claimed by any volume", file=sys.stderr)


def main():
    global BOOK_LANG
    ap = argparse.ArgumentParser()
    ap.add_argument("--volume", help="build one volume by slug")
    ap.add_argument("--pdf", action="store_true", help="also render PDF via xelatex")
    ap.add_argument("--assemble-only", action="store_true", help="skip pandoc")
    ap.add_argument("--lang", default="en",
                    help="build a translated edition from i18n/<lang>/ (English fallback per lesson)")
    args = ap.parse_args()
    BOOK_LANG = args.lang

    check_phases()

    vols = CONFIG["volumes"]
    if args.volume:
        vols = [v for v in vols if v["slug"] == args.volume]
        if not vols:
            sys.exit(f"unknown volume: {args.volume}")

    for vol in vols:
        md, chapters, words = assemble(vol)
        print(f"vol {vol['number']} {vol['slug']}: {chapters} chapters, {words:,} words -> {md}")
        if not args.assemble_only:
            for artifact in render(vol, md, chapters, pdf=args.pdf):
                size = artifact.stat().st_size // 1024
                print(f"  {artifact} ({size} KB)")


if __name__ == "__main__":
    main()
