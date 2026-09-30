#!/usr/bin/env python3
"""Translate the site's interface strings and publish i18n/<lang>/ui.json.

Lesson bodies are translated by translate_lessons.py. The interface around them
(header navigation, sidebar, checkpoint loop, quiz headings, panels, previous and
next buttons, homepage and catalog labels) is static English in the page
templates, and site/ui-i18n.js swaps it in the browser from a per-language
dictionary keyed by the English string.

site/ui-strings.json is the only hand-maintained input: "keys" lists the English
interface strings the pages use, "overrides" pins a translation per language
where a machine translation would be wrong (short labels such as Build or Run).
Every other key is translated through the same provider layer as the lessons,
and a previously published translation is reused, so a run only translates keys
that are new or lost their override. The published file records which keys were
pinned, so removing an override retranslates that key instead of freezing the old
pin. Output goes to the translations branch, never to main.

Usage:
    python3 scripts/translate_ui_strings.py                       # every ci:true language, NLLB
    python3 scripts/translate_ui_strings.py --lang zh --provider anthropic
    python3 scripts/translate_ui_strings.py --dry-run             # report, no model load
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import translate_lessons as lessons  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "site" / "ui-strings.json"
OUT_ROOT = ROOT / "i18n"

FIXED = re.compile(r"\.[A-Za-z]|[/@⌘]")
COMMAND = re.compile(r"[a-z]+(?:-[a-z]+)+")
TRAIL = ".,:;!?"

UI_SYSTEM = """You translate short user-interface labels for a website that teaches AI engineering, from English into {lang}.

Rules:
- Keep every placeholder of the form {placeholder} exactly as given, in place. They stand for file names, paths, and commands.
- Keep product names as they are: GitHub, MCP, Codex, Claude Code.
- Use the register of a software interface: concise, neutral, no added words.
- Keep the same sentence-final punctuation as the source.
- Output only the translation."""


def load_source(path=SOURCE):
    data = json.loads(path.read_text(encoding="utf-8"))
    keys = data.get("keys") or []
    overrides = data.get("overrides") or {}
    problems = check_source(keys, overrides)
    if problems:
        raise SystemExit("\n".join(f"{path.name}: {p}" for p in problems))
    return keys, overrides


def check_source(keys, overrides):
    problems = []
    seen = set()
    for key in keys:
        if not isinstance(key, str) or not key.strip():
            problems.append(f"empty key {key!r}")
        elif key != key.strip():
            problems.append(f"key has surrounding whitespace: {key!r}")
        elif key in seen:
            problems.append(f"duplicate key: {key!r}")
        seen.add(key)
    for lang, table in overrides.items():
        if not isinstance(table, dict):
            problems.append(f"overrides for {lang} must be an object")
            continue
        for key, value in table.items():
            if key not in seen:
                problems.append(f"{lang} override for a key that is not in the key list: {key!r}")
            if not isinstance(value, str) or not value.strip() or value != value.strip():
                problems.append(f"{lang} override for {key!r} must be a trimmed non-empty string")
    return problems


def ci_languages():
    return [e["code"] for e in lessons._load_registry() if e.get("ci") and not e.get("source")]


def protect_ui(text):
    store = []
    parts = []
    for token in re.split(r"(\s+)", text):
        if not token or token.isspace():
            parts.append(token)
            continue
        body, tail = token, ""
        while body and body[-1] in TRAIL:
            tail = body[-1] + tail
            body = body[:-1]
        if body and (FIXED.search(body) or COMMAND.fullmatch(body)):
            store.append(body)
            parts.append(lessons.SENTINEL.format(len(store) - 1) + tail)
        else:
            parts.append(token)
    return "".join(parts), store


def translate_label(text, translate_fn):
    protected, store = protect_ui(text)
    out = translate_fn(protected)
    if out is None or sorted(lessons.SENT_RE.findall(out)) != sorted(lessons.SENT_RE.findall(protected)):
        return None
    return lessons.restore(out, store).strip()


def translator(lang, provider):
    if provider == "echo":
        return lambda s: s
    if provider == "nllb":
        tgt = lessons.NLLB_CODES.get(lang)
        if not tgt:
            raise SystemExit(f"no NLLB (FLORES-200) code for language {lang!r} in languages.json")
        pipe = lessons._nllb_pipe(tgt)
        return lambda s: lessons._nllb_sentence(pipe, s)
    system = UI_SYSTEM.format(lang=lessons.LANG_NAMES.get(lang, lang), placeholder=lessons.SENTINEL.format("<number>"))
    if provider == "anthropic":
        return lambda s: lessons._anthropic(system, s)
    if provider == "openai":
        return lambda s: lessons._openai(system, s)
    if provider == "deepl":
        return lambda s: lessons._deepl(s, lang)
    raise SystemExit(f"unknown provider: {provider}")


class Lazy:
    def __init__(self, make):
        self.make = make
        self.fn = None

    def __call__(self, text):
        if self.fn is None:
            self.fn = self.make()
        return self.fn(text)


def load_published(path):
    """Return (strings, pinned) from a previously published ui.json. A flat
    object carries no pin provenance, so every value in it counts as pinned and
    is refreshed once rather than reused blindly."""
    if not path.is_file():
        return {}, set()
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {}, set()
    if isinstance(data.get("strings"), dict):
        return data["strings"], set(data.get("pinned") or [])
    return data, set(data)


def build_language(keys, overrides, existing, translate_fn, pinned_before=frozenset()):
    """Return (strings, translated_count). translate_fn runs only for keys with
    neither an override nor a reusable published translation; a published value
    that came from an override which has since been removed is not reused. None
    counts those keys without translating (dry run)."""
    result = {}
    translated = 0
    for key in keys:
        if key in overrides:
            result[key] = overrides[key]
        elif key in existing and key not in pinned_before:
            result[key] = existing[key]
        elif translate_fn is None:
            translated += 1
        else:
            out = translate_label(key, translate_fn)
            if not out:
                print(f"WARNING placeholder mismatch for {key!r}; leaving it English", file=sys.stderr)
                continue
            result[key] = out
            translated += 1
    return result, translated


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", action="append", help="language code; repeat for several. Default: every ci:true language")
    ap.add_argument("--provider", default=os.environ.get("TRANSLATE_PROVIDER", "nllb"))
    ap.add_argument("--force", action="store_true", help="retranslate every key that has no override")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default=str(OUT_ROOT), help=argparse.SUPPRESS)
    ap.add_argument("--source", default=str(SOURCE), help=argparse.SUPPRESS)
    args = ap.parse_args(argv)

    keys, overrides = load_source(Path(args.source))
    langs = args.lang or ci_languages()
    for lang in langs:
        if lang not in lessons.LANG_NAMES:
            raise SystemExit(f"unknown language {lang!r}: not in languages.json")
        dst = Path(args.out) / lang / "ui.json"
        existing, pinned_before = ({}, set()) if args.force else load_published(dst)
        pins = overrides.get(lang, {})
        translate_fn = None if args.dry_run else Lazy(lambda lang=lang: translator(lang, args.provider))
        strings, count = build_language(keys, pins, existing, translate_fn, pinned_before)
        if args.dry_run:
            print(f"{lang}: would translate {count} of {len(keys)} keys")
            continue
        published = {"strings": strings, "pinned": [key for key in keys if key in pins]}
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(json.dumps(published, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{lang}: {count} translated, {len(strings) - count} reused or pinned -> {dst}")


if __name__ == "__main__":
    main()
