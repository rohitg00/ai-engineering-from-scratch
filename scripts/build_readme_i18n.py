#!/usr/bin/env python3
"""Maintain localized README files against the canonical English README.

The historical span-based renderer remains available to help prepare drafts.
Published localized READMEs are maintained as documents: this command checks their links, anchors, numeric
facts, tables, and code instead of overwriting editorial revisions.

    python3 scripts/build_readme_i18n.py --dump     # list translatable blocks
    python3 scripts/build_readme_i18n.py            # sync stats and audit every locale
    python3 scripts/build_readme_i18n.py --check     # fail on structural drift

Full locale documents in i18n/<lang>/README.md are committed to main (unlike
lesson translations on the translations branch). English stays canonical.
"""
import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
OUT_ROOT = ROOT / "i18n"

sys.path.insert(0, str(Path(__file__).resolve().parent))

FENCE = re.compile(r"^\s*```")
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
BLOCKQUOTE = re.compile(r"^>\s?(.*)$")
STRUCTURAL = re.compile(r"^\s*(<|\||!\[|<!--|\[!\[|-{3,}\s*$|\d+\.\s|[-*]\s)")


def is_prose(line):
    s = line.strip()
    if not s or STRUCTURAL.match(line) or s.startswith("```"):
        return False
    if re.fullmatch(r"\[[^\]]+\]\([^)]+\)", s):  # a lone link/badge line
        return False
    return bool(re.search(r"[A-Za-z]{3,}", s))


def block_key(lines):
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def spans(text):
    """Return translatable spans as dicts with original line indices.

    kind='heading' spans one line; kind='prose' spans a maximal run of prose
    (or blockquote-prose) lines. Everything else is left untouched.
    """
    lines = text.split("\n")
    i, in_code, out = 0, False, []
    while i < len(lines):
        line = lines[i]
        if FENCE.match(line):
            in_code = not in_code
            i += 1
            continue
        if in_code:
            i += 1
            continue
        m = HEADING.match(line)
        if m:
            out.append({"kind": "heading", "start": i, "end": i + 1,
                        "prefix": m.group(1) + " ", "key": block_key([m.group(2)])})
            i += 1
            continue
        bq = BLOCKQUOTE.match(line)
        if bq and is_prose(bq.group(1)):
            start, block = i, []
            while i < len(lines):
                inner = BLOCKQUOTE.match(lines[i])
                if not (inner and is_prose(inner.group(1))):
                    break
                block.append(inner.group(1))
                i += 1
            out.append({"kind": "prose", "start": start, "end": i,
                        "prefix": "> ", "key": block_key(block)})
            continue
        if is_prose(line):
            start, block = i, []
            while i < len(lines) and is_prose(lines[i]):
                block.append(lines[i])
                i += 1
            out.append({"kind": "prose", "start": start, "end": i,
                        "prefix": "", "key": block_key(block)})
            continue
        i += 1
    return out


# repo-root-relative link/image targets, excluding absolute URLs, anchors, and
# paths that already point upward. Two capture groups: the opener and the target.
_HTML_LINK = re.compile(r'((?:href|src|srcset)=")(?!https?://|/|#|mailto:|data:|\.\.?/)([^"]+)')
_MD_LINK = re.compile(r'(\]\()(?!https?://|/|#|mailto:|data:|\.\.?/)([^)]+)')
_HTML_ALT = re.compile(r'(\balt=")([^"]+)(")')
_HTML_TEXT = re.compile(r'>([^<>]+)<')
_PROTECTED_HTML_TEXT = frozenset({'Become a sponsor'})


def localize_links(md):
    """Prefix ../../ to repo-root-relative links so a README two levels deep in
    i18n/<lang>/ still resolves images, the lesson table, and the language bar.

    Fenced code blocks are left untouched, so code like ``tools[call.name](**kw)``
    (which looks like a Markdown link) is never rewritten."""
    out, in_code = [], False
    for line in md.split("\n"):
        if FENCE.match(line):
            in_code = not in_code
            out.append(line)
            continue
        if in_code:
            out.append(line)
            continue
        line = _HTML_LINK.sub(lambda m: m.group(1) + "../../" + m.group(2), line)
        line = _MD_LINK.sub(lambda m: m.group(1) + "../../" + m.group(2), line)
        out.append(line)
    return "\n".join(out)


def translate_html(line, table):
    """Translate mapped alt text and visible HTML text without changing markup."""
    line = _HTML_ALT.sub(
        lambda match: match.group(1) + table.get(match.group(2), match.group(2)) + match.group(3),
        line,
    )

    def replace_text(match):
        text = match.group(1)
        if text in _PROTECTED_HTML_TEXT:
            return match.group(0)
        return '>' + table.get(text, text) + '<'

    return _HTML_TEXT.sub(replace_text, line)


def render(text, lang, translations):
    table = translations.get(lang, {})
    lines = text.split("\n")
    # replace bottom-up so earlier indices stay valid
    for sp in sorted(spans(text), key=lambda s: s["start"], reverse=True):
        t = table.get(sp["key"])
        if not t:
            continue
        replacement = [sp["prefix"] + ln for ln in t.split("\n")]
        lines[sp["start"]:sp["end"]] = replacement
    in_code = False
    for index, line in enumerate(lines):
        if FENCE.match(line):
            in_code = not in_code
            continue
        if not in_code:
            lines[index] = translate_html(table.get(line, line), table)
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    text = README.read_text(encoding="utf-8")

    assert render(text, "en", {}) == text, "generator is not structure-lossless"

    if args.dump:
        keys = [sp["key"] for sp in spans(text)]
        for k in keys:
            print(f"- {k}")
        print(f"\n{len(keys)} translatable blocks; round-trip identity OK", file=sys.stderr)
        return 0

    from audit_readme_locales import (
        FULL_LOCALES, check_document as audit_locale,
        source_review_errors, sync_stats_facts,
    )

    review_errors = source_review_errors(text)
    if review_errors:
        for error in review_errors:
            print(error, file=sys.stderr)
        return 1

    stale = []
    for lang in FULL_LOCALES:
        dst = OUT_ROOT / lang / "README.md"
        if not dst.is_file():
            stale.append(lang)
            continue
        original = dst.read_text(encoding="utf-8")
        try:
            content = original if args.check else sync_stats_facts(text, original)
        except ValueError as exc:
            stale.append(lang)
            print(f"{lang}: {exc}", file=sys.stderr)
            continue
        errors = audit_locale(text, content, lang)
        if errors:
            stale.append(lang)
            for error in errors:
                print(f"{lang}: {error}", file=sys.stderr)
        elif not args.check:
            if content != original:
                dst.write_text(content, encoding="utf-8")
                print(f"synced stats in {dst.relative_to(ROOT)}")
            print(f"preserved full {dst.relative_to(ROOT)}")
    if stale:
        print(f"README translations need review: {stale}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
