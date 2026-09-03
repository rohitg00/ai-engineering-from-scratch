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
import tempfile
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

FENCE = re.compile(r"^ {0,3}```(?P<info>.*)$")
ASSET_IMG = re.compile(r"\]\(\.\./assets/")
HEADING2 = re.compile(r"^## ")
CANONICAL_H2_KIND_BY_TITLE = {
    "Ship It": "artifact",
    "Shipped Artifact": "artifact",
    "Exercises": "practice",
    "Practice Lab": "practice"
}
BOOK_SECTION_TITLE_ALIASES = {
    "ar": {
        "artifact": frozenset({"أرسله", "الأثاث المُرسل"}),
        "practice": frozenset({"التمارين", "مختبر التدريب"}),
    },
    "es": {
        "artifact": frozenset({"Envío", "Artículo enviado"}),
        "practice": frozenset({"Los ejercicios", "Laboratorio de práctica"}),
    },
    "fr": {
        "artifact": frozenset({"La faire partir", "Artéfact expédié"}),
        "practice": frozenset({"Exercices", "Laboratoire de pratique"}),
    },
    "hi": {
        "artifact": frozenset({"इसे भेजें", "शिप की गई कलाकृतियाँ"}),
        "practice": frozenset({"व्यायाम", "अभ्यास प्रयोगशाला"}),
    },
    "tr": {
        "artifact": frozenset({"Gönder", "Nakliye edilen Sanatlı"}),
        "practice": frozenset({"Egzersizler", "Pratik Laboratuvar"}),
    },
    "pt": {
        "artifact": frozenset({"Envia-o", "Artefato enviado"}),
        "practice": frozenset({"Exercícios", "Laboratório de prática"}),
    },
    "vi": {
        "artifact": frozenset({"Chuyển nó", "Hiện vật đã vận chuyển"}),
        "practice": frozenset({"Các bài tập", "Phòng thực hành"}),
    },
    "zh": {
        "artifact": frozenset({
            "交付成果",
            "交付物",
            "交付它",
            "交付上线",
            "交付产物",
            "产出",
            "放进系统里",
        }),
        "practice": frozenset({
            "练习",
            "动手练习",
            "实践实验",
        }),
    },
}

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


def continue_box(u, has_quiz):
    lines = [
        "**Continue online.** The living edition of this chapter has more than the page can hold:",
        "",
        f"- Animated, interactive figures and the web text: <{u['web']}>",
        f"- Runnable code for every step: <{u['code']}>",
    ]
    if has_quiz:
        lines.append(f"- The chapter quiz, graded in the browser: <{u['web']}>")
    lines += [
        "",
        "The repository moves faster than any printing. When the book and the repo disagree, trust the repo.",
    ]
    return fenced_div("continue-online", *lines)


def fence_end(src, i):
    """Index of the line that closes the fence opened at src[i] (len(src) if unclosed)."""
    j = i + 1
    while j < len(src) and src[j].strip() != "```":
        j += 1
    return j


BOOK_LANG = "en"  # set by --lang; selects translated source when available


def _lesson_source(phase, lesson, source_root=ROOT, book_lang=None):
    book_lang = BOOK_LANG if book_lang is None else book_lang
    en = source_root / "phases" / phase / lesson / "docs" / "en.md"
    if book_lang != "en":
        tr = source_root / "i18n" / book_lang / "phases" / phase / lesson / "docs" / f"{book_lang}.md"
        if tr.is_file():
            return tr
    return en


def translation_coverage(vol, book_lang=None):
    """Return ``(localized, total)`` for one volume and selected language."""
    book_lang = BOOK_LANG if book_lang is None else book_lang
    localized = total = 0
    for phase in vol["phases"]:
        for lesson_dir in lesson_dirs(phase):
            total += 1
            canonical = lesson_dir / "docs" / "en.md"
            if _lesson_source(phase, lesson_dir.name, ROOT, book_lang) != canonical:
                localized += 1
    return localized, total


def require_translation_coverage(vol, book_lang=None):
    """Reject mislabeled editions and report any per-lesson fallback."""
    book_lang = BOOK_LANG if book_lang is None else book_lang
    if book_lang == "en":
        return
    localized, total = translation_coverage(vol, book_lang)
    if total and localized == 0:
        raise SystemExit(
            f"volume {vol['slug']}: no {book_lang} lesson translations found; "
            "restore the configured translations branch before building"
        )
    if localized < total:
        raise SystemExit(
            f"volume {vol['slug']}: incomplete {book_lang} translation coverage "
            f"({localized}/{total}); restore the configured translations branch "
            "before building"
        )


def require_translation_provenance(volumes, book_lang=None):
    """Audit every selected translated phase before any book output is written."""
    book_lang = BOOK_LANG if book_lang is None else book_lang
    if book_lang == "en":
        return

    # Keep the translation pipeline dependency off the English build path.
    # audit_translations is the canonical cache/provenance implementation, so
    # the book builder deliberately delegates instead of parsing cache records.
    import audit_translations as translation_audit

    source = translation_audit.LocalTranslationSource(ROOT)
    phases = dict.fromkeys(
        phase for volume in volumes for phase in volume["phases"]
    )
    for phase in phases:
        try:
            result = translation_audit.audit_translations(
                ROOT, book_lang, source, phase
            )
        except (translation_audit.TranslationSourceError, ValueError) as exc:
            raise SystemExit(
                f"translation preflight failed for {book_lang} phase {phase}: {exc}"
            ) from exc
        if result.issues:
            raise SystemExit(
                f"translation preflight failed for {book_lang} phase {phase}:\n"
                f"{translation_audit.render_report(result)}"
            )


def _canonical_h2_kinds(phase, lesson, source_root=ROOT):
    """Map each level-two heading to its language-independent book role.

    Translated lessons preserve the canonical heading order, but naturally
    localize headings such as "Ship It" and "Exercises".  Drive the book
    transforms from the matching English heading instead of requiring every
    translation to retain those two English labels.
    """
    source = source_root / "phases" / phase / lesson / "docs" / "en.md"
    return [
        CANONICAL_H2_KIND_BY_TITLE.get(title)
        for title in _h2_titles(source.read_text(encoding="utf-8").splitlines())
    ]


def _localized_h2_kind(title, book_lang):
    """Resolve a special book role without requiring an English title."""
    canonical_kind = CANONICAL_H2_KIND_BY_TITLE.get(title)
    if canonical_kind is not None:
        return canonical_kind
    for kind, aliases in BOOK_SECTION_TITLE_ALIASES.get(book_lang, {}).items():
        if title in aliases:
            return kind
    return None


def _validate_h2_sections(canonical_lines, localized_lines, source, book_lang):
    """Fail closed when localized sections cannot be aligned safely.

    The translation audit makes heading order and count contractual. Titles may
    be translated, but special book roles use an explicit per-language alias
    contract so equal-count deletion/insertion or reordering cannot silently
    assign a canonical role to the wrong H2. Unknown languages fail closed
    unless these special headings retain their canonical English titles.
    """
    canonical_titles = _h2_titles(canonical_lines)
    localized_titles = _h2_titles(localized_lines)
    if len(localized_titles) != len(canonical_titles):
        raise ValueError(
            f"H2 structure mismatch in {source}: expected "
            f"{len(canonical_titles)} H2 headings, found {len(localized_titles)}"
        )

    canonical_roles = tuple(
        (index, title, kind)
        for index, title in enumerate(canonical_titles, start=1)
        if (kind := CANONICAL_H2_KIND_BY_TITLE.get(title)) is not None
    )
    expected = tuple((index, kind) for index, _, kind in canonical_roles)
    localized_roles = tuple(
        (
            index,
            localized_titles[index - 1],
            _localized_h2_kind(localized_titles[index - 1], book_lang),
        )
        for index, _, _ in canonical_roles
    )
    found = tuple((index, kind) for index, _, kind in localized_roles)
    if found != expected:
        raise ValueError(
            f"H2 section mismatch in {source}: expected canonical special "
            f"sections {canonical_roles!r}, found localized special sections "
            f"{localized_roles!r}"
        )
    return [CANONICAL_H2_KIND_BY_TITLE.get(title) for title in canonical_titles]


def _h2_titles(lines):
    """Return level-two headings outside fenced code blocks."""
    titles = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if FENCE.match(line):
            i = fence_end(lines, i) + 1
            continue
        i += 1
        if not HEADING2.match(line):
            continue
        titles.append(line[3:].strip())
    return titles


def transform_lesson(phase, lesson_dir, source_root=ROOT, book_lang=None):
    lesson = lesson_dir.name
    u = urls_for(phase, lesson)
    has_quiz = (lesson_dir / "quiz.json").is_file()
    source = _lesson_source(phase, lesson, source_root, book_lang)
    src = source.read_text(encoding="utf-8").splitlines()
    canonical_source = (
        source_root / "phases" / phase / lesson / "docs" / "en.md"
    )
    canonical_src = canonical_source.read_text(encoding="utf-8").splitlines()
    canonical_h2_kinds = _validate_h2_sections(
        canonical_src, src, source, book_lang or BOOK_LANG
    )

    out = []
    balanced = True
    h2_index = 0
    i = 0
    while i < len(src):
        line = src[i]

        if FENCE.match(line):
            end = fence_end(src, i)
            if end >= len(src):
                balanced = False
            info = FENCE.match(line).group("info").strip()
            block = src[i + 1 : end]
            if info == "figure":
                fig_id = block[0].strip() if block else "figure"
                out += fenced_div(
                    "interactive-figure",
                    f"**Interactive figure: `{fig_id}`.** This one moves. Watch it animate and drag its controls in the web edition: <{u['web']}>",
                )
            elif info == "mermaid":
                rendered = render_mermaid(block)
                if rendered:
                    out += ["", f"![diagram]({rendered})", ""]
                else:
                    out += fenced_div(
                        "interactive-figure",
                        f"**Diagram.** Rendered live in the web edition: <{u['web']}>",
                    )
            else:
                out += src[i : end + 1]
            i = end + 1
            continue

        section_kind = None
        if HEADING2.match(line):
            if h2_index < len(canonical_h2_kinds):
                section_kind = canonical_h2_kinds[h2_index]
            h2_index += 1

        if section_kind == "artifact":
            out += fenced_div(
                "continue-online",
                f"**This chapter ships an artifact.** The course version of this lesson produces a reusable prompt or agent skill. It lives in the repository, ready to install: <{u['repo']}>",
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

        if section_kind == "practice":
            out.append(line)
            out.append("")
            out.append(f"Starter code and the lesson's working implementation: <{u['code']}>")
            i += 1
            continue

        out.append(ASSET_IMG.sub(f"](phases/{phase}/{lesson}/assets/", line))
        i += 1

    if h2_index != len(canonical_h2_kinds):
        raise ValueError(
            f"H2 structure mismatch in {source}: expected to transform "
            f"{len(canonical_h2_kinds)} H2 headings, found {h2_index}"
        )

    if not balanced:
        raise ValueError(f"unbalanced code fence in {lesson_dir / 'docs' / 'en.md'}")

    out += continue_box(u, has_quiz)
    return out


def _transform_lesson_fixture(fixture):
    """Exercise the production book transform with isolated lesson sources."""
    canonical = fixture.get("canonical")
    localized = fixture.get("localized")
    if not isinstance(canonical, str) or not isinstance(localized, str):
        raise ValueError("fixture canonical and localized fields must be strings")

    phase = "99-book-transform-fixture"
    lesson = "01-localized-sections"
    book_lang = fixture.get("lang", "zh")
    if not isinstance(book_lang, str):
        raise ValueError("fixture lang must be a string")
    with tempfile.TemporaryDirectory(prefix="build-book-fixture-") as temp_dir:
        source_root = Path(temp_dir)
        lesson_dir = source_root / "phases" / phase / lesson
        docs_dir = lesson_dir / "docs"
        docs_dir.mkdir(parents=True)
        (docs_dir / "en.md").write_text(canonical, encoding="utf-8")

        localized_doc = (
            source_root
            / "i18n"
            / book_lang
            / "phases"
            / phase
            / lesson
            / "docs"
            / f"{book_lang}.md"
        )
        localized_doc.parent.mkdir(parents=True)
        localized_doc.write_text(localized, encoding="utf-8")

        return {
            "canonicalH2Kinds": _canonical_h2_kinds(phase, lesson, source_root),
            "transformed": "\n".join(
                transform_lesson(
                    phase,
                    lesson_dir,
                    source_root=source_root,
                    book_lang=book_lang,
                )
            ),
        }


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
    return re.sub(r"^Phase\s+\d+\s*[:—-]\s*", "", raw).strip()


def series_map(vol):
    rows = []
    for v in CONFIG["volumes"]:
        marker = "**" if v["slug"] == vol["slug"] else ""
        phases = ", ".join(p.split("-")[0] for p in v["phases"])
        rows.append(f"| {marker}{v['number']}{marker} | {marker}{v['title']}{marker} — {v['subtitle']} | {phases} |")
    return "\n".join([
        "| Vol | Title | Course phases |",
        "|-----|-------|---------------|",
    ] + rows)


def how_to_use(vol):
    return f"""# About This Volume {{.unnumbered}}

This is Volume {vol['number']} of *{CONFIG['series']}*, a six-volume compilation of the open course of the same name. Each volume stands alone; cross-references cite course phase numbers, which map to volumes like this:

{series_map(vol)}

The chapters in this volume come from course phases {', '.join(p.split('-')[0] for p in vol['phases'])}. Chapter prerequisites name phases, not volumes; use the table above to translate.

# How to Use This Book {{.unnumbered}}

This volume is one loop of a larger machine, and it works best when you run the whole loop:

1. **Read the chapter here.** The prose, the derivations, and the code walkthroughs are complete on the page.
2. **Run the code from the repository.** Every chapter has a `code/` directory with a working implementation you can run and break: <{REPO}>
3. **Open the web edition for what paper cannot do.** Animated figures you can watch and drag, and a quiz per chapter that grades itself: <{SITE}>

The repository is the living edition. Lessons are updated as the field moves; the book is a snapshot with a version number. When they disagree, the repo is right.

## Learning with an AI {{.unnumbered}}

This course is built to be read by agents as well as people. The machine-readable index of every lesson lives at <{SITE}/llms.txt>. If you learn with an AI assistant, paste this and go:

> I am working through *{CONFIG["series"]}, Volume {vol["number"]}: {vol["title"]}*. Fetch {SITE}/llms.txt, find the lesson I name, and act as my tutor: quiz me on its Key Terms, review my solutions to its Exercises, and walk me through its code from the repository.
"""


def assemble(vol):
    require_translation_coverage(vol)
    BUILD.mkdir(parents=True, exist_ok=True)
    parts = [how_to_use(vol)]
    chapters = 0
    for part_idx, phase in enumerate(vol["phases"]):
        title = clean_phase_title(phase_title(phase))
        parts.append(
            f"\n# Part {ROMAN[part_idx]} — {title} {{.unnumbered .part}}\n\n"
            f"*Course phase {phase.split('-')[0]}. Live edition with animated figures and quizzes: <{SITE}/catalog.html>*\n"
        )
        for lesson_dir in lesson_dirs(phase):
            parts.append("\n".join(transform_lesson(phase, lesson_dir)))
            chapters += 1
    text = "\n\n".join(parts)
    md = BUILD / f"{vol['slug']}.md"
    md.write_text(text, encoding="utf-8")
    return md, chapters, len(text.split())


def metadata(vol, book_lang="en"):
    meta = BUILD / f"{vol['slug']}-meta.yaml"
    meta.write_text(
        "---\n"
        f"title: \"{CONFIG['series']}\"\n"
        f"subtitle: \"Volume {vol['number']} — {vol['title']}: {vol['subtitle']}\"\n"
        f"author: \"{CONFIG['author']}\"\n"
        f"lang: {book_lang}\n"
        "toc-title: Contents\n"
        "---\n",
        encoding="utf-8",
    )
    return meta


def render(vol, md, chapters, pdf=False):
    DIST.mkdir(parents=True, exist_ok=True)
    meta = metadata(vol, BOOK_LANG)
    suffix = "" if BOOK_LANG == "en" else f"-{BOOK_LANG}"
    epub = DIST / f"aiefs-vol{vol['number']}-{vol['slug']}{suffix}.epub"
    cmd = [
        "pandoc", str(meta), str(md),
        "-o", str(epub),
        "--from", "markdown+fenced_divs",
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
            .replace("@TITLE@", vol["title"])
            .replace("@SUBTITLE@", vol["subtitle"]),
            encoding="utf-8",
        )
        pdf_out = DIST / f"aiefs-vol{vol['number']}-{vol['slug']}{suffix}.pdf"
        cmd_pdf = [
            "pandoc", str(md),
            "-o", str(pdf_out),
            "--from", "markdown+fenced_divs",
            "--toc", "--toc-depth=1",
            "--top-level-division=chapter",
            "--pdf-engine=xelatex",
            "--columns=40",
            "--resource-path", str(ROOT),
            "--include-in-header", str(ROOT / "book" / "theme.tex"),
            "--include-before-body", str(titlepage),
            "-M", f"title-meta={CONFIG['series']} Volume {vol['number']}: {vol['title']}",
            "-M", "author-meta=aiengineeringfromscratch.com",
            "-M", f"lang={BOOK_LANG}",
            "-V", "toc-title=Contents",
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
            "zh-TW": ["Noto Sans CJK TC", "Noto Serif CJK TC", "Source Han Serif TC"],
            "ja": ["Noto Sans CJK JP", "Noto Serif CJK JP", "Source Han Serif JP"],
            "ko": ["Noto Sans CJK KR", "Noto Serif CJK KR", "Source Han Serif KR"],
        }
        if BOOK_LANG in cjk_candidates:
            cjk = pick_font(cjk_candidates[BOOK_LANG])
            if cjk:
                cmd_pdf += ["-V", f"CJKmainfont={cjk}"]
        try:
            subprocess.run(cmd_pdf, check=True, cwd=ROOT)
            results.append(pdf_out)
        except subprocess.CalledProcessError:
            print(f"warning: PDF render failed for {vol['slug']} (non-fatal)", file=sys.stderr)
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
    ap.add_argument(
        "--lang",
        default="en",
        help="build a complete, audited edition from i18n/<lang>/",
    )
    ap.add_argument("--test-transform-fixture", action="store_true",
                    help=argparse.SUPPRESS)
    args = ap.parse_args()
    if args.test_transform_fixture:
        json.dump(_transform_lesson_fixture(json.load(sys.stdin)), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return

    BOOK_LANG = args.lang

    check_phases()

    vols = CONFIG["volumes"]
    if args.volume:
        vols = [v for v in vols if v["slug"] == args.volume]
        if not vols:
            sys.exit(f"unknown volume: {args.volume}")

    require_translation_provenance(vols)

    for vol in vols:
        md, chapters, words = assemble(vol)
        print(f"vol {vol['number']} {vol['slug']}: {chapters} chapters, {words:,} words -> {md}")
        if not args.assemble_only:
            for artifact in render(vol, md, chapters, pdf=args.pdf):
                size = artifact.stat().st_size // 1024
                print(f"  {artifact} ({size} KB)")


if __name__ == "__main__":
    main()
