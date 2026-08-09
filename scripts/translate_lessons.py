#!/usr/bin/env python3
"""Translate lesson markdown into other languages, preserving all technical spans.

The English lessons are canonical. This produces machine translations of the
prose only: fenced code, inline code, math, figure/mermaid blocks, links,
image refs, and the metadata header are preserved byte-for-byte. Output is
written to a separate tree (default: i18n/<lang>/...) that a CI job commits to
a translations branch, never to main. Runs are hash-cached, so a lesson is
re-translated only when its English source changes.

Usage:
    LLM_API_KEY=... python3 scripts/translate_lessons.py --lang zh
    python3 scripts/translate_lessons.py --lang zh --phase 05-nlp-foundations-to-advanced
    python3 scripts/translate_lessons.py --lang ru --scope certifications/claude
    python3 scripts/translate_lessons.py --lang tr --only phases/00-setup-and-tooling/01-dev-environment
    python3 scripts/translate_lessons.py --lang zh --dry-run   # show what would translate, no API calls

Provider is pluggable via --provider. Default is "nllb" (the free open model that
runs locally). Optional upgrades: anthropic|openai|deepl. "echo" makes no network
calls and returns the source unchanged, for wiring/tests.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_catalog import LESSON_DIR_RE, PHASE_DIR_RE  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PHASES = ROOT / "phases"
CERTIFICATION_LESSONS = ROOT / "certifications" / "claude" / "lessons"
OUT_ROOT = ROOT / "i18n"
SCOPES = ("core", "certifications/claude")


def cache_path(lang, phase=None, scope="core"):
    # Per-(language, source slice) cache so sharded CI jobs never touch the same
    # file: each job publishes only its own slice, so caches merge without
    # clobbering and a timed-out run resumes exactly where it stopped. A full
    # local run (no --phase) keeps the single combined cache.
    if scope == "certifications/claude":
        return OUT_ROOT / lang / ".cache" / "certifications-claude.json"
    if phase:
        return OUT_ROOT / lang / ".cache" / f"{phase}.json"
    return OUT_ROOT / lang / ".translate-cache.json"

def _load_registry():
    # languages.json is a committed canonical file; fail loudly if it is missing
    # rather than masking that with a silent hardcoded fallback.
    return json.loads((ROOT / "languages.json").read_text(encoding="utf-8"))["languages"]


_REG = _load_registry()
LANG_NAMES = {entry["code"]: entry["name"] for entry in _REG if not entry.get("source")}
NLLB_CODES = {entry["code"]: entry.get("nllb") for entry in _REG}

# Inline span vocabulary, named once so the two protection lists compose from the
# same regexes instead of copy-pasting them.
INLINE_CODE = re.compile(r"`[^`\n]+`")
INLINE_MATH = re.compile(r"(?<!\\)\$[^$\n]+?(?<!\\)\$")
IMAGE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
LINK = re.compile(r"(?<!!)\[[^\]]+\]\([^)]+\)")   # [text](url) whole
BOLD = re.compile(r"\*\*[^*\n]+\*\*|__[^_\n]+__")
BARE_URL = re.compile(r"https?://[^\s)]+")        # do not eat a link's paren

# Whole-document protection for the LLM path.
PROTECT = [
    re.compile(r"```.*?\n.*?```", re.S),          # fenced code / figure / mermaid
    re.compile(r"~~~.*?\n.*?~~~", re.S),          # alt fenced
    re.compile(r"\$\$.*?\$\$", re.S),              # display math
    INLINE_CODE, INLINE_MATH, IMAGE, BARE_URL,
]
# NLLB is not instruction-following, so per line we also shield full markdown links
# and bold spans (almost always technical terms). Links are matched before bare urls.
NLLB_INLINE = [INLINE_CODE, INLINE_MATH, IMAGE, LINK, BOLD, BARE_URL]

SENTINEL = "⁣PROTECT{}⁣"  # invisible separator, unlikely in prose
SENT_RE = re.compile(r"⁣PROTECT\d+⁣")


def protect(text, patterns=PROTECT):
    store = []

    def stash(m):
        store.append(m.group(0))
        return SENTINEL.format(len(store) - 1)

    for pat in patterns:
        text = pat.sub(stash, text)
    return text, store


def restore(text, store):
    # reverse order so a span that itself contains a lower-indexed sentinel
    # (e.g. a link whose url was protected first) resolves correctly.
    for i in range(len(store) - 1, -1, -1):
        text = text.replace(SENTINEL.format(i), store[i])
    return text


SYSTEM = """You are a professional technical translator for a machine-learning engineering course.
Translate the given Markdown prose from English into {lang}.

Hard rules:
- Preserve every placeholder token of the form ⁣PROTECT<number>⁣ EXACTLY, unchanged, in its original position. These stand for code, math, and URLs. Never translate, reorder, or drop them.
- Preserve Markdown structure exactly: headings (#), lists, tables, bold/italic markers, blockquotes.
- Do NOT translate: proper nouns and technical product/architecture names (Word2Vec, Skip-gram, CBOW, softmax, Transformer, PyTorch, ReLU, Adam, GPT, BERT, model ids), or the metadata labels **Type:**, **Languages:**, **Prerequisites:**, **Time:**. Translate the values after those labels only where they are ordinary words (e.g. "Build" may stay English).
- Keep technical register: precise, plain, no added marketing.
- Output only the translated Markdown. No preamble, no code fences around the whole thing."""


def translate_text(text, lang, provider):
    """Translate protected prose. Returns translated text with sentinels intact."""
    if provider == "echo" or not text.strip():
        return text
    lang_name = LANG_NAMES.get(lang, lang)
    system = SYSTEM.format(lang=lang_name)
    if provider == "anthropic":
        return _anthropic(system, text)
    if provider == "openai":
        return _openai(system, text)
    if provider == "deepl":
        return _deepl(text, lang)
    raise SystemExit(f"unknown provider: {provider}")


def _anthropic(system, text):
    import anthropic  # noqa

    client = anthropic.Anthropic(api_key=os.environ["LLM_API_KEY"])
    model = os.environ.get("LLM_MODEL", "claude-sonnet-5")
    msg = client.messages.create(
        model=model, max_tokens=8192,
        system=system, messages=[{"role": "user", "content": text}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")


def _openai(system, text):
    from openai import OpenAI  # noqa

    client = OpenAI(api_key=os.environ["LLM_API_KEY"])
    model = os.environ.get("LLM_MODEL", "gpt-4o")
    r = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": text}],
    )
    return r.choices[0].message.content


def _deepl(text, lang):
    import urllib.request
    import urllib.parse

    data = urllib.parse.urlencode({
        "auth_key": os.environ["LLM_API_KEY"], "text": text,
        "target_lang": lang.upper(), "tag_handling": "xml", "ignore_tags": "x",
    }).encode()
    req = urllib.request.Request("https://api-free.deepl.com/v2/translate", data=data)
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    return payload["translations"][0]["text"]


# ── NLLB-200: free, key-less, runs in the CI runner ──────────────────────────
_NLLB = {}
META_RE = re.compile(r"^\s*\*\*(Type|Languages|Prerequisites|Time):\*\*")
MARKER_RE = re.compile(r"^(\s*)((?:#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)*)(.*)$")
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _nllb_pipe(tgt):
    if tgt not in _NLLB:
        from transformers import pipeline  # noqa
        model = os.environ.get("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
        _NLLB[tgt] = pipeline(
            "translation", model=model, src_lang="eng_Latn", tgt_lang=tgt, max_length=512,
        )
    return _NLLB[tgt]


def _nllb_sentence(pipe, text):
    # NLLB truncates past ~512 tokens; split long fragments by sentence.
    if len(text) <= 400:
        return pipe(text)[0]["translation_text"]
    return " ".join(pipe(s)[0]["translation_text"] for s in SENT_SPLIT.split(text) if s.strip())


def nllb_translate_doc(src, tgt, translate_fn=None):
    """Prose-only walker: code/math/figures/bold/links never reach the model.

    Works line by line on the raw source so classification (fence, table,
    metadata) sees the real markdown, then protects inline spans per line.
    translate_fn(str)->str lets tests pass identity; production uses the NLLB pipe.
    """
    if translate_fn is None:
        pipe = _nllb_pipe(tgt)
        translate_fn = lambda s: _nllb_sentence(pipe, s)  # noqa: E731

    out_lines = []
    in_fence = in_mathblock = False
    for line in src.split("\n"):
        s = line.lstrip()
        if s.startswith("```") or s.startswith("~~~"):
            in_fence = not in_fence
            out_lines.append(line)
            continue
        if s.startswith("$$"):  # display-math block delimiter
            in_mathblock = not in_mathblock
            out_lines.append(line)
            continue
        # verbatim: code/math blocks, blanks, tables, raw-HTML lines, metadata header.
        # image spans are protected inline (NLLB_INLINE) so a line with an image plus
        # a caption still gets its caption translated.
        if (in_fence or in_mathblock or not line.strip() or s.startswith("|")
                or s.startswith("<") or META_RE.match(line)):
            out_lines.append(line)
            continue

        protected, store = protect(line, NLLB_INLINE)
        m = MARKER_RE.match(protected)
        indent, markers, body = m.group(1), m.group(2), m.group(3)
        # capturing split -> alternating [text, sentinel, text, ...]; translate text only
        parts = re.split(r"(⁣PROTECT\d+⁣)", body)
        rebuilt = "".join(
            p if (SENT_RE.fullmatch(p) or not p.strip()) else translate_fn(p) for p in parts
        )
        out_lines.append(restore(indent + markers + rebuilt, store))
    return "\n".join(out_lines)


def source_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()


def core_lesson_docs():
    # Same "what is a lesson" definition as the catalog/book/llms.txt tooling,
    # so a non-conforming dir can't become a translated, published lesson.
    for phase in sorted(PHASES.iterdir()):
        if not (phase.is_dir() and PHASE_DIR_RE.match(phase.name)):
            continue
        for lesson in sorted(phase.iterdir()):
            doc = lesson / "docs" / "en.md"
            if lesson.is_dir() and LESSON_DIR_RE.match(lesson.name) and doc.is_file():
                yield doc


def certification_lesson_docs():
    """Yield only sources satisfying the shared certification lesson contract."""
    if not CERTIFICATION_LESSONS.is_dir():
        return
    for lesson in sorted(CERTIFICATION_LESSONS.iterdir()):
        doc = lesson / "docs" / "en.md"
        if lesson.is_dir() and LESSON_DIR_RE.match(lesson.name) and doc.is_file():
            yield doc


def lesson_docs(scope="core"):
    if scope == "core":
        yield from core_lesson_docs()
    elif scope == "certifications/claude":
        yield from certification_lesson_docs()
    else:  # callers outside argparse still fail closed
        raise ValueError(f"unknown translation scope: {scope}")


def targets(scope="core"):
    # Lessons only. The per-language README is hand-authored and built by
    # scripts/build_readme_i18n.py into i18n/<lang>/README.md; translating it
    # here would overwrite that file with a machine translation, so the README
    # is deliberately not a target of this script.
    yield from lesson_docs(scope)


def validate_only(value, scope, docs):
    """Return a canonical selector, rejecting traversal and out-of-scope paths."""
    if value is None:
        return None
    if "\\" in value:
        raise ValueError("invalid --only path")
    stripped = value.rstrip("/")
    path = PurePosixPath(stripped)
    if not stripped or path.is_absolute() or any(part in ("", ".", "..") for part in path.parts):
        raise ValueError("invalid --only path")

    known = {}
    for doc in docs:
        rel = doc.relative_to(ROOT).as_posix()
        known[rel] = rel
        known[PurePosixPath(rel).parent.parent.as_posix()] = rel
    if stripped not in known:
        raise ValueError(f"invalid --only path for scope {scope}: {value}")
    return known[stripped]


def out_path(doc, lang):
    rel = doc.relative_to(ROOT).parent / f"{lang}.md"
    return OUT_ROOT / lang / rel


def translate_doc(src, lang, provider):
    """Return translated markdown for one lesson. NLLB uses the prose walker;
    LLM/DeepL providers protect-translate-restore the whole document."""
    if provider == "nllb":
        tgt = NLLB_CODES.get(lang)
        if not tgt:
            raise SystemExit(f"no NLLB (FLORES-200) code for language {lang!r} in languages.json")
        return nllb_translate_doc(src, tgt)
    protected, store = protect(src)
    raw = translate_text(protected, lang, provider)
    if raw.count("⁣") != protected.count("⁣"):
        return None  # placeholder mismatch -> caller keeps English
    return restore(raw, store)


def prune_orphans(*, docs, lang, scope, phase, cache, dry_run):
    """Remove outputs/cache entries whose canonical English lesson disappeared."""
    canonical = {
        str(doc.relative_to(ROOT)) for doc in docs
        if not phase or f"/{phase}/" in f"/{doc.relative_to(ROOT)}"
    }
    removed = 0
    for key in list(cache):
        if key not in canonical:
            print(f"would remove stale cache entry {key}" if dry_run else f"removed stale cache entry {key}")
            if not dry_run:
                del cache[key]
            removed += 1

    scope_root = OUT_ROOT / lang
    if scope == "core":
        scope_root = scope_root / "phases"
        if phase:
            scope_root = scope_root / phase
    else:
        scope_root = scope_root / "certifications/claude/lessons"
    if scope_root.is_dir():
        for dst in scope_root.rglob(f"{lang}.md"):
            source_rel = str(dst.relative_to(OUT_ROOT / lang).with_name("en.md"))
            if source_rel in canonical:
                continue
            print(f"would remove orphaned output {dst}" if dry_run else f"removed orphaned output {dst}")
            if not dry_run:
                dst.unlink()
                parent = dst.parent
                while parent != scope_root and parent.is_dir() and not any(parent.iterdir()):
                    parent.rmdir()
                    parent = parent.parent
            removed += 1
    return removed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True)
    ap.add_argument("--provider", default=os.environ.get("TRANSLATE_PROVIDER", "nllb"))
    ap.add_argument("--scope", choices=SCOPES, default="core",
                    help="translation source scope (default: core phases)")
    ap.add_argument("--phase", help="limit to one phase dir name")
    ap.add_argument("--only", help="limit to one lesson path (phases/.../lesson)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.lang not in LANG_NAMES:
        ap.error(f"unknown target language: {args.lang}")
    if args.scope != "core" and args.phase:
        ap.error("--phase is valid only with --scope core")
    if args.phase:
        phases = {
            path.name for path in PHASES.iterdir()
            if path.is_dir() and PHASE_DIR_RE.match(path.name)
        }
        if args.phase not in phases:
            ap.error(f"invalid --phase: {args.phase}")
    docs = list(targets(args.scope))
    try:
        only_doc = validate_only(args.only, args.scope, docs)
    except ValueError as error:
        ap.error(str(error))

    cpath = cache_path(args.lang, args.phase, args.scope)
    cache = {}
    if cpath.is_file():
        cache = json.loads(cpath.read_text(encoding="utf-8"))

    def save_cache():
        cpath.parent.mkdir(parents=True, exist_ok=True)
        cpath.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")

    if not only_doc:
        prune_orphans(
            docs=docs, lang=args.lang, scope=args.scope, phase=args.phase,
            cache=cache, dry_run=args.dry_run,
        )

    translated = skipped = 0
    for doc in docs:
        rel = str(doc.relative_to(ROOT))
        if args.phase and f"/{args.phase}/" not in f"/{rel}":
            continue
        if only_doc and rel != only_doc:
            continue

        src = doc.read_text(encoding="utf-8")
        h = source_hash(src)
        dst = out_path(doc, args.lang)
        # key is the lesson path; the cache file is already per-language
        if cache.get(rel) == h and dst.is_file():
            skipped += 1
            continue

        if args.dry_run:
            print(f"would translate -> {dst.relative_to(ROOT)}")
            translated += 1
            continue

        out = translate_doc(src, args.lang, args.provider)
        dst.parent.mkdir(parents=True, exist_ok=True)
        if out is None:
            # provider dropped a placeholder; keep English but DON'T cache it,
            # so a later run retries instead of freezing this lesson in English
            print(f"WARNING placeholder mismatch in {rel}; keeping English", file=sys.stderr)
            dst.write_text(src, encoding="utf-8")
            continue
        dst.write_text(out, encoding="utf-8")
        cache[rel] = h
        translated += 1
        # persist after every lesson so a killed run resumes here, never restarts
        save_cache()
        print(f"translated {rel} -> {args.lang}")

    if not args.dry_run:
        save_cache()
    print(f"{args.lang}: {translated} translated, {skipped} unchanged (cache hit)")


if __name__ == "__main__":
    main()
