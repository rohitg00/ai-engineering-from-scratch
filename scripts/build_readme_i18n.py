#!/usr/bin/env python3
"""Build translated README files from the canonical English README.

The README is mostly structure: a banner, badges, a 584-row lesson table, and
HTML blocks. Only prose and headings are translated; every other byte is kept
exactly, so a translation can never break the layout, the lesson table, or a
link. The generator works by replacing only the translated line-spans in a copy
of the original file, so a language with no translations round-trips to a
byte-identical README (asserted on every run).

Translations are hand-authored (highest quality for a landing page) and stored
in scripts/readme_translations.py, keyed by the exact English block. Any block
without a translation falls back to English.

    python3 scripts/build_readme_i18n.py --dump     # list translatable blocks
    python3 scripts/build_readme_i18n.py            # write i18n/<lang>/README.md
    python3 scripts/build_readme_i18n.py --check     # fail if any output is stale

Output goes to i18n/<lang>/README.md and is committed to main (unlike the lesson
translations, which live on the translations branch). English stays canonical.
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
_HTML_LINK = re.compile(r'((?:href|src)=")(?!https?://|/|#|mailto:|data:|\.\.?/)([^"]+)')
_MD_LINK = re.compile(r'(\]\()(?!https?://|/|#|mailto:|data:|\.\.?/)([^)]+)')


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
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    text = README.read_text(encoding="utf-8")

    assert render(text, "en", {}) == text, "generator is not structure-lossless"

    if args.dump:
        keys = [sp["key"] for sp in spans(text)]
        for k in keys:
            print(f"- {k}")
        print(f"\n{len(keys)} translatable blocks; round-trip identity OK", file=sys.stderr)
        return 0

    from readme_translations import TRANSLATIONS, README_NOTE

    stale = []
    for lang in TRANSLATIONS:
        note = README_NOTE.get(lang, "")
        body = localize_links(render(text, lang, TRANSLATIONS))
        content = f"{note}\n{body}" if note else body
        dst = OUT_ROOT / lang / "README.md"
        if args.check:
            if not dst.is_file() or dst.read_text(encoding="utf-8") != content:
                stale.append(lang)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(content, encoding="utf-8")
            print(f"wrote {dst.relative_to(ROOT)}")
    if args.check and stale:
        print(f"stale README translations: {stale}; run build_readme_i18n.py", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
