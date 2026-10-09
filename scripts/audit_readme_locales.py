#!/usr/bin/env python3
"""Check that localized READMEs preserve the English README's structure.

This checks coverage, facts and navigation, not translation fluency.
"""

from __future__ import annotations

import argparse
from collections import Counter
from decimal import Decimal
import hashlib
from html import unescape
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "README.md"
SOURCE_DIGEST = ROOT / "i18n" / "readme-source.sha256"
FULL_LOCALES = (
    "es", "fr", "pt", "pt-BR", "de", "it", "zh", "zh-TW", "ja", "ko", "hi",
    "ar", "ru", "tr", "id", "nl", "vi", "sv", "fi", "pl", "cs", "ro", "he",
    "fa", "tl", "da", "no", "hu", "el", "uk", "th", "bn", "ur",
)
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
MD_LINK = re.compile(r"\]\(([^)]+)\)")
HTML_TARGET = re.compile(r'\b(?:href|srcset|src)="([^"]+)"')
HTML_TEXT = re.compile(r">([^<>]+)<")
HTML_ALT = re.compile(r'\balt="([^"]+)"')
HTML_ID = re.compile(r'\bid="([^"]+)"')
FIGURE_SUB = re.compile(r"<sub>(FIG_\d{3}\s*·\s*[A-Z])</sub>")
INLINE_CODE = re.compile(r"`([^`\n]+)`")
LESSON_ROW = re.compile(r"^\|\s*\d{2}\s*\|\s*\[[^\]]+\]\((?:\.\./\.\./)?(phases/[^)]+)\)", re.M)
FACT = re.compile(r"(?<!\d)\d+(?:,\d{3})*(?:-\d{2})*(?:\.\d+)?")
STATS_BLOCK = re.compile(r"(<!-- STATS:START[^\n]*-->)(.*?)(<!-- STATS:END -->)", re.S)
BOLD_COUNT = re.compile(r"(?<=<b>)\d[\d,]*(?=</b>)")
ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
LANGUAGE_LINK = re.compile(r'href="(?:\.\./\.\./)?i18n/([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)/README\.md"')
HTML_TABLE_TAG = re.compile(r"<\s*(/?)\s*(table|thead|tbody|tfoot|tr|th|td)\b[^>]*>", re.I)

# Product names, paper titles and established technical names are not prose.
SHARED_TERMS = frozenset({
    "Claude Code", "Codex", "Docker", "EPUB", "PDF", "EPUB · PDF", "Python",
    "Julia", "Rust", "TypeScript", "YAML", "Shell", "PPO", "StyleGAN",
    "Jupyter Notebooks", "Naive Bayes", "Model Context Protocol (MCP)",
    "OpenTelemetry GenAI", "Anthropic Responsible Scaling Policy v3.0",
    "Q-Learning, SARSA", "Singular Value Decomposition", "Support Vector Machines",
    "Deep Q-Networks (DQN)", "Differential Attention (V2)",
    "Few-Shot, CoT, Tree-of-Thought", "Mixture of Experts (MoE)",
    "Multi-Token Prediction (MTP)", "Native Sparse Attention (DeepSeek NSA)",
    "RAG: Retrieval-Augmented Generation", "Text-to-Speech (TTS)",
    "Vision Transformer Encoder", "Context Engineering", "Prompt Engineering",
})
# Some short labels have the same spelling in English and the target language.
SHARED_LABELS = {
    "fr": frozenset({"Sponsors", "Phases", "Type", "20 phases", "CONCEPT"}),
    "de": frozenset({"PROBLEM"}),
    "pl": frozenset({"PROBLEM"}),
    "ro": frozenset({"CONCEPT"}),
    "da": frozenset({"Type"}),
    "no": frozenset({"Type"}),
}


def source_fingerprint(source: str) -> str:
    def mask_stats(match):
        stats = BOLD_COUNT.sub("COUNT", match.group(2))
        stats = ISO_DATE.sub("DATE", stats)
        return match.group(1) + stats + match.group(3)

    reviewed_content = STATS_BLOCK.sub(mask_stats, source)
    return hashlib.sha256(reviewed_content.encode("utf-8")).hexdigest()


def source_review_errors(source: str) -> list[str]:
    if language_codes(source) != set(FULL_LOCALES):
        return ["README language navigation must match the complete locales in FULL_LOCALES"]
    if not SOURCE_DIGEST.is_file():
        return ["missing i18n/readme-source.sha256 translation review record"]
    if SOURCE_DIGEST.read_text(encoding="utf-8").strip() != source_fingerprint(source):
        return ["English README changed: review every locale before updating i18n/readme-source.sha256"]
    return []


def body(text: str) -> str:
    lines = text.splitlines(keepends=True)
    if lines and re.match(r"^<p\b[^>]*><sub>", lines[0]):
        lines = lines[1:]
    return "".join(lines)


def unlocalize_target(target: str) -> str:
    if target.startswith("../../"):
        return target[6:]
    return target


def link_targets(text: str) -> Counter[str]:
    return Counter(unlocalize_target(t) for t in MD_LINK.findall(text) + HTML_TARGET.findall(text))


def fence_step(line: str, opener: str | None) -> tuple[bool, str | None]:
    match = FENCE.match(line)
    if match is None:
        return False, opener
    run, rest = match.groups()
    if opener is None:
        if run[0] == "`" and "`" in rest:
            return False, None
        return True, run
    if run[0] == opener[0] and len(run) >= len(opener) and not rest.strip():
        return True, None
    return False, opener


def outside_fences(text: str) -> str:
    lines = []
    opener = None
    for line in text.splitlines():
        fence, opener = fence_step(line, opener)
        if not fence and opener is None:
            lines.append(line)
    return "\n".join(lines)


def local_link_errors(text: str, lang: str) -> list[str]:
    errors = []
    base = ROOT / "i18n" / lang
    visible = outside_fences(text)
    for target in MD_LINK.findall(visible) + HTML_TARGET.findall(visible):
        if target.startswith(("http://", "https://", "#", "mailto:", "data:")):
            continue
        path = target.split("#", 1)[0].split("?", 1)[0]
        if not path:
            continue
        if not path.startswith("../../"):
            errors.append(f"repo-relative target lacks ../../ prefix: {target}")
            continue
        if not (base / path).exists():
            errors.append(f"repo-relative target does not exist: {target}")
    return list(dict.fromkeys(errors))


def fenced_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    opener = None
    for line in text.splitlines():
        fence, new_opener = fence_step(line, opener)
        if opener is None:
            if fence:
                current = [line]
        else:
            current.append(line)
            if fence:
                blocks.append("\n".join(current))
                current = []
        opener = new_opener
    if opener is not None:
        raise ValueError("unclosed fenced code block")
    return blocks


def mermaid_topology(block: str) -> str:
    return re.sub(r'"[^"]*"', '""', block)


def tree_topology(block: str) -> str:
    return re.sub(
        r"((?:code/|en\.md|outputs/|prompts/|skills/))\s{2,}[^\n]*",
        r"\1",
        block,
    )


def table_cells(text: str) -> list[int]:
    counts = []
    for line in text.splitlines():
        if line.lstrip().startswith("|"):
            counts.append(len(re.findall(r"(?<!\\)\|", line)))
    return counts


def list_item_counts(text: str) -> tuple[int, int]:
    visible = outside_fences(text)
    unordered = len(re.findall(r"^\s*[-*+]\s+", visible, re.M))
    ordered = len(re.findall(r"^\s*\d+\.\s+", visible, re.M))
    return unordered, ordered


def prose_blocks(text: str) -> list[str]:
    visible = re.sub(r"<!--.*?-->", "", outside_fences(body(text)), flags=re.S)
    blocks = []
    current = []
    for line in visible.splitlines() + [""]:
        line = re.sub(r"^>\s?", "", line.strip())
        structural = re.match(r"^(#{1,6}\s|\||[-*+]\s|\d+\.\s)", line)
        has_text = re.sub(r"<[^>]*>", "", line).strip()
        if not has_text or structural:
            if current:
                blocks.append(" ".join(current))
                current = []
        else:
            current.append(line)
    return blocks


def language_codes(text: str) -> set[str]:
    return set(LANGUAGE_LINK.findall(text))


def prose_fragments(text: str) -> set[str]:
    visible = re.sub(r"<!--.*?-->", "", outside_fences(text), flags=re.S)
    # Also compare complete paragraphs so line wrapping cannot hide English fallback.
    visible += "\n" + "\n".join(prose_blocks(text))
    # Diagram labels are rendered prose even though Mermaid uses a code fence.
    try:
        blocks = fenced_blocks(text)
    except ValueError:
        blocks = []  # The structural check reports malformed fences separately.
    for block in blocks:
        if block.startswith("```mermaid"):
            visible += "\n" + "\n".join(re.findall(r'"([^"\n]+)"', block))
        elif block.startswith("```text") and "├──" in block:
            visible += "\n" + "\n".join(re.findall(
                r"(?:code/|en\.md|outputs/|prompts/|skills/) {2,}([^\n]+)", block,
            ))
    visible = re.sub(
        r'<a\b[^>]*href="(?:\.\./\.\./)?(?:i18n/[^/]+/)?README\.md"[^>]*>.*?</a>',
        "", visible, flags=re.S,
    )
    descriptions = HTML_ALT.findall(visible)
    visible = re.sub(r"</?(?:p|div|table|thead|tbody|tfoot|tr|th|td|br|h[1-6])\b[^>]*>", "\n", visible)
    visible = re.sub(r"<[^>]*>", "", visible)
    fragments = set()
    for line in visible.splitlines() + descriptions:
        line = INLINE_CODE.sub("", line)
        line = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", line)
        line = re.sub(r"https?://[^\s)]+", "", line)
        cells = re.split(r"(?<!\\)\|", line) if line.lstrip().startswith("|") else [line]
        for cell in cells:
            value = re.sub(r"\s+", " ", unescape(cell)).strip(" #*>|:·-")
            if re.search(r"[A-Za-z]{3}", value):
                fragments.add(value)
    return fragments


def untranslated_fragments(source: str, locale: str, lang: str) -> list[str]:
    identical = prose_fragments(source) & prose_fragments(locale)
    allowed = SHARED_TERMS | SHARED_LABELS.get(lang, frozenset())
    errors = []
    for value in sorted(identical):
        if value in allowed:
            continue
        if all(part.strip() in SHARED_TERMS for part in value.split(",")):
            continue
        if re.fullmatch(r"[\w./-]+\.(?:md|py|js|json|yaml)", value):
            continue
        if re.fullmatch(r"@[\w-]+|(?:[\w-]+\.)+[a-z]{2,}", value):
            continue
        if re.fullmatch(r"FIG_\d{3}\s*·\s*[A-Z]", value):
            continue
        if re.fullmatch(r"[A-E]\. (?:NLP LLM|Multimodal VLM)", value):
            continue
        if value.startswith("— **Andrej Karpathy**"):
            continue
        # Bibliography titles are published names; their phase references are facts.
        if re.fullmatch(r".+\* (?:\([^)]+\) )?(?:— .+ )?→ Phase \d+", value):
            continue
        errors.append(value)
    return errors


def protected_inline_tokens(text: str) -> set[str]:
    return {
        token for token in INLINE_CODE.findall(text)
        if not re.fullmatch(r"\d+ lessons", token)
        and not token.startswith(" comment listing non-stdlib deps")
    }


def numeric_amounts(text: str) -> tuple[Decimal, ...]:
    text = unicodedata.normalize("NFKC", unescape(text))
    text = "".join(str(unicodedata.decimal(char)) if char.isdecimal() else char for char in text)
    return tuple(Decimal(number.replace(",", ".").replace("٫", "."))
                 for number in re.findall(r"[0-9]+(?:[.,٫][0-9]+)?", text))


def phase_summary_counts(text: str) -> list[tuple[str, tuple[Decimal, ...]]]:
    visible = outside_fences(text)
    result = []
    setup = re.search(r'<a id="phase-0"></a>\s*(### [^\n]+)', visible)
    if setup:
        result.append(("phase-0", numeric_amounts(setup.group(1))))
    for phase, summary in re.findall(
        r'<details\b[^>]*\bid="(phase-\d+)"[^>]*>\s*<summary>(.*?)</summary>', visible, re.S,
    ):
        counts = " ".join(re.findall(r"<code\b[^>]*>(.*?)</code>", summary, re.S))
        result.append((phase, numeric_amounts(counts)))
    return result


def study_time_amounts(text: str) -> list[tuple[Decimal, ...]]:
    tables, current = [], []
    for line in outside_fences(text).splitlines() + [""]:
        if line.lstrip().startswith("|"):
            current.append(line)
        elif current:
            tables.append(current)
            current = []
    routes = ("learning-paths/model-context-protocol.json", "learning-paths/agent-skills.json")
    matches = [table for table in tables if all(route in "\n".join(table) for route in routes)]
    if len(matches) != 1:
        raise ValueError("expected exactly one study-time table")
    return [numeric_amounts(re.split(r"(?<!\\)\|", row)[-2]) for row in matches[0][2:]]


def landing_facts(text: str) -> tuple[str, str]:
    before_stats, _, rest = text.partition("<!-- STATS:START")
    stats, _, _ = rest.partition("<!-- STATS:END -->")
    hero = "\n".join(line for line in before_stats.splitlines() if line.startswith(">"))
    return hero, stats


def route_contexts(text: str, path: str) -> list[str]:
    return [
        text[max(0, match.start() - 240):match.start() + len(path) + 240]
        for match in re.finditer(re.escape(path), text)
    ]


def sync_stats_facts(source: str, locale: str) -> str:
    source_match = STATS_BLOCK.search(source)
    locale_match = STATS_BLOCK.search(locale)
    if source_match is None or locale_match is None:
        raise ValueError("README stats block is missing")
    source_stats = source_match.group(2)
    locale_stats = locale_match.group(2)
    source_counts = BOLD_COUNT.findall(source_stats)
    locale_counts = BOLD_COUNT.findall(locale_stats)
    if len(source_counts) != 2 or len(locale_counts) != 2:
        raise ValueError("README stats reader/page-view counts are missing")
    source_date = ISO_DATE.findall(source_stats)
    locale_date = ISO_DATE.findall(locale_stats)
    if len(source_date) != 1 or len(locale_date) != 1:
        raise ValueError("README stats date is missing")
    replacements = iter(source_counts)
    translated_stats = BOLD_COUNT.sub(lambda _: next(replacements), locale_stats)
    translated_stats = ISO_DATE.sub(source_date[0], translated_stats, count=1)
    return locale[:locale_match.start(2)] + translated_stats + locale[locale_match.end(2):]


def check(source: str, locale: str, lang: str) -> list[str]:
    errors: list[str] = []
    language_bar = language_codes(source)
    if not set(FULL_LOCALES).issubset(language_bar) or lang not in language_bar:
        errors.append("root README language bar is missing complete locales")
    if link_targets(source) != link_targets(locale):
        missing = link_targets(source) - link_targets(locale)
        extra = link_targets(locale) - link_targets(source)
        errors.append(f"links differ: missing={sum(missing.values())}, extra={sum(extra.values())}")
    identical_prose = untranslated_fragments(source, locale, lang)
    if identical_prose:
        errors.append(f"English text remains untranslated: {len(identical_prose)} fragment(s), e.g. {identical_prose[:5]}")
    localized_inline = set(INLINE_CODE.findall(locale))
    missing_tokens = sorted(token for token in protected_inline_tokens(source) if token not in localized_inline)
    if missing_tokens:
        errors.append(f"inline code formatting missing: {len(missing_tokens)} token(s), e.g. {missing_tokens[:5]}")
    source_headings = Counter(re.findall(r"^(#{1,6})\s", outside_fences(source), re.M))
    locale_headings = Counter(re.findall(r"^(#{1,6})\s", outside_fences(locale), re.M))
    if source_headings != locale_headings:
        errors.append("heading counts or levels differ")
    if len(prose_blocks(source)) != len(prose_blocks(locale)):
        errors.append("prose block counts differ")
    if table_cells(source) != table_cells(locale):
        errors.append("table row or cell counts differ")
    if HTML_TABLE_TAG.findall(outside_fences(source)) != HTML_TABLE_TAG.findall(outside_fences(locale)):
        errors.append("HTML table structure differs")
    if list_item_counts(source) != list_item_counts(locale):
        errors.append("Markdown list item counts differ")
    if Counter(HTML_ID.findall(source)) != Counter(HTML_ID.findall(locale)):
        errors.append("explicit HTML IDs differ")
    if Counter(FIGURE_SUB.findall(source)) != Counter(FIGURE_SUB.findall(locale)):
        errors.append("figure identifiers differ")
    errors.extend(local_link_errors(locale, lang))
    source_lesson_rows = LESSON_ROW.findall(source)
    locale_lesson_rows = LESSON_ROW.findall(locale)
    if not source_lesson_rows:
        errors.append("English README has no linked lesson rows")
    if len(locale_lesson_rows) != len(source_lesson_rows):
        errors.append("lesson row count differs")
    if Counter(source_lesson_rows) != Counter(locale_lesson_rows):
        errors.append("lesson link destinations differ")
    source_languages = [line.rsplit("|", 2)[-2].strip() for line in source.splitlines() if LESSON_ROW.match(line)]
    locale_languages = [line.rsplit("|", 2)[-2].strip() for line in locale.splitlines() if LESSON_ROW.match(line)]
    if source_lesson_rows != locale_lesson_rows or source_languages != locale_languages:
        errors.append("lesson order or programming-language labels differ")
    for path in (
        "learning-paths/model-context-protocol.json",
        "learning-paths/agent-skills.json",
        "learning-paths/using-coding-agents.json",
        "learning-paths/shaping-the-build.json",
    ):
        source_context = " ".join(
            source[max(0, match.start() - 180):match.start()]
            for match in re.finditer(re.escape(path), source)
        )
        ranges = set(re.findall(r"(?<!\d)(\d{2})\s*[-–—]\s*(\d{2})(?!\d)", source_context))
        contexts = route_contexts(locale, path)
        for first, last in ranges:
            marker = rf"(?<!\d){first}(?!\d)[^\d]{{0,24}}(?<!\d){last}(?!\d)"
            if not any(re.search(marker, context) for context in contexts):
                errors.append(f"course range {first}–{last} missing near {path}")
    if phase_summary_counts(source) != phase_summary_counts(locale):
        errors.append("phase summary lesson counts differ")
    try:
        if study_time_amounts(source) != study_time_amounts(locale):
            errors.append("study-time table numeric amounts differ")
    except ValueError as exc:
        errors.append(str(exc))
    source_hero, source_stats = landing_facts(source)
    hero, stats = landing_facts(locale)
    if Counter(FACT.findall(source_hero)) != Counter(FACT.findall(hero)):
        errors.append("hero numeric facts differ")
    if Counter(FACT.findall(source_stats)) != Counter(FACT.findall(stats)):
        errors.append("stats numeric facts differ")
    if BOLD_COUNT.findall(source_stats) != BOLD_COUNT.findall(stats):
        errors.append("reader and page-view counts differ")
    if re.search(r'\b(?:alt|title)"', locale):
        errors.append("malformed HTML alt/title attribute")

    try:
        original_fences = fenced_blocks(source)
        translated_fences = fenced_blocks(locale)
    except ValueError as exc:
        errors.append(str(exc))
        original_fences, translated_fences = [], []
    if len(original_fences) != len(translated_fences):
        errors.append("fenced code block count differs")
    else:
        for index, (original, translated) in enumerate(zip(original_fences, translated_fences)):
            if original.startswith("```mermaid"):
                if mermaid_topology(original) != mermaid_topology(translated):
                    errors.append(f"Mermaid topology changed in block {index}")
            elif original.startswith("```text") and "├──" in original:
                if tree_topology(original) != tree_topology(translated):
                    errors.append(f"directory tree paths changed in block {index}")
            elif original != translated:
                errors.append(f"code block {index} changed")

    if "Read in your language:" in locale:
        errors.append("language navigation heading remains English")
    return errors


def check_document(source: str, document: str, lang: str) -> list[str]:
    first_line = document.splitlines()[0] if document else ""
    errors = []
    if not re.match(r"^<p\b[^>]*><sub>", first_line):
        errors.append("localized README has no language note")
    if 'href="../../README.md"' not in first_line:
        errors.append("language note has no canonical English link")
    return errors + check(source, body(document), lang)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", choices=FULL_LOCALES)
    args = parser.parse_args()
    source = SOURCE.read_text(encoding="utf-8")
    review_errors = source_review_errors(source)
    for error in review_errors:
        print(error)
    failed = bool(review_errors)
    for lang in ((args.lang,) if args.lang else FULL_LOCALES):
        path = ROOT / "i18n" / lang / "README.md"
        if not path.is_file():
            print(f"{lang}: missing {path.relative_to(ROOT)}")
            failed = True
            continue
        document = path.read_text(encoding="utf-8")
        errors = check_document(source, document, lang)
        if errors:
            failed = True
            print(f"{lang}: FAIL")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"{lang}: coverage, structure and facts preserved")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
