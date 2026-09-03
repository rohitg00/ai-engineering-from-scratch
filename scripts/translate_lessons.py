#!/usr/bin/env python3
"""Translate lesson markdown into other languages, preserving all technical spans.

The English lessons are canonical. This produces machine translations of the
prose only: fenced code, inline code, math, figure/mermaid blocks, links,
image refs, and the metadata header are preserved byte-for-byte. Output is
written to a separate tree (default: i18n/<lang>/...) that a CI job commits to
a translations branch, never to main. Runs are hash-cached, so a lesson is
re-translated only when its English source changes.

Usage:
    LLM_API_KEY=... python3 scripts/translate_lessons.py --lang fr
    python3 scripts/translate_lessons.py --lang tr --phase 05-nlp-foundations-to-advanced
    python3 scripts/translate_lessons.py --lang tr --only phases/00-setup-and-tooling/01-dev-environment
    python3 scripts/translate_lessons.py --lang tr --dry-run   # show what would translate, no API calls

Provider is pluggable via --provider. Default is "nllb" (the free open model that
runs locally). Optional upgrades: anthropic|openai|deepl. "echo" makes no network
calls and returns the source unchanged, for wiring/tests.
"""

import argparse
from collections import Counter
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_catalog import LESSON_DIR_RE, PHASE_DIR_RE  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PHASES = ROOT / "phases"
OUT_ROOT = ROOT / "i18n"


def cache_path(lang, phase=None):
    # Per-(language, phase) cache so the sharded CI jobs never touch the same
    # file: each job publishes only its own phase slice, so caches merge without
    # clobbering and a timed-out run resumes exactly where it stopped. A full
    # local run (no --phase) keeps the single combined cache.
    if phase:
        validate_phase(ROOT, phase)
        return _safe_language_path(lang, ".cache", f"{phase}.json")
    return _safe_language_path(lang, ".translate-cache.json")


def write_text_atomically(path, text):
    """Replace *path* without exposing a partially written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(text)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def write_json_atomically(path, value):
    """Serialize *value* before atomically replacing its JSON file."""
    write_text_atomically(path, json.dumps(value, indent=2, ensure_ascii=False))


def _translation_lock_path(lang):
    """Return a process-shared lock path outside published output trees."""
    validate_language(lang)
    root_fingerprint = hashlib.sha256(
        os.fsencode(str(OUT_ROOT.absolute()))
    ).hexdigest()[:24]
    lock_root = Path(tempfile.gettempdir()) / f"aifs-translation-locks-{os.getuid()}"
    lock_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    return lock_root / f"{root_fingerprint}-{lang}.lock"


@contextmanager
def translation_lock(lang):
    """Serialize writers that can touch one language's caches or outputs."""
    lock_path = _translation_lock_path(lang)
    flags = os.O_CREAT | os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(lock_path, flags, 0o600)
    with os.fdopen(descriptor, "a+") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def _load_registry():
    # languages.json is a committed canonical file; fail loudly if it is missing
    # rather than masking that with a silent hardcoded fallback.
    return json.loads((ROOT / "languages.json").read_text(encoding="utf-8"))["languages"]


_REG = _load_registry()
LANGUAGE_REGISTRY = {entry["code"]: entry for entry in _REG}
LANG_NAMES = {entry["code"]: entry["name"] for entry in _REG if not entry.get("source")}
NLLB_CODES = {entry["code"]: entry.get("nllb") for entry in _REG}
TRANSLATION_PROVIDERS = frozenset({"nllb", "anthropic", "openai", "deepl"})
TRANSLATION_PIPELINE_VERSION = "2026-08-31.1"
DEFAULT_TRANSLATION_MODELS = {
    "nllb": "facebook/nllb-200-distilled-600M",
    "anthropic": "claude-sonnet-5",
    "openai": "gpt-4o",
    "deepl": "api-free.deepl.com/v2",
    "echo": "echo",
}


def translation_model(provider):
    """Return the exact configured model/backend used by *provider*."""
    if provider == "nllb":
        return os.environ.get("NLLB_MODEL", DEFAULT_TRANSLATION_MODELS[provider])
    if provider in {"anthropic", "openai"}:
        return os.environ.get("LLM_MODEL", DEFAULT_TRANSLATION_MODELS[provider])
    return DEFAULT_TRANSLATION_MODELS.get(provider, provider)


def validate_language(lang, *, allow_manual=False):
    """Return a safe registered target language or raise ``ValueError``.

    Registry membership is the path-segment allowlist. Path-looking values
    such as ``x/../zh`` and ``../../`` are rejected, never normalized.
    """
    entry = LANGUAGE_REGISTRY.get(lang)
    if entry is None:
        raise ValueError(f"unknown language {lang!r}; choose a code from languages.json")
    if entry.get("source"):
        raise ValueError(f"language {lang!r} is the canonical source, not a translation")
    if entry.get("manual") and not allow_manual:
        raise ValueError(
            f"language {lang!r} is human-maintained; refusing machine translation"
        )
    return lang


def validate_phase(repo_root, phase):
    """Return an existing, repository-contained phase directory name."""
    if phase is None:
        return None
    if PHASE_DIR_RE.fullmatch(phase) is None:
        raise ValueError(f"invalid phase directory name {phase!r}")
    phases_root = (Path(repo_root) / "phases").resolve()
    candidate = (phases_root / phase).resolve()
    if not candidate.is_relative_to(phases_root) or not candidate.is_dir():
        raise ValueError(f"phase directory does not exist in this repository: {phase!r}")
    return phase


def _safe_language_path(lang, *parts):
    """Resolve an output path and prove it remains below its language root."""
    validate_language(lang)
    lexical_output_root = OUT_ROOT.absolute()
    lexical_language_root = lexical_output_root / lang
    lexical_target = lexical_language_root.joinpath(*parts)
    cursor = lexical_output_root
    if cursor.is_symlink():
        raise ValueError(f"translation output root is a symlink: {cursor}")
    for part in Path(lang, *parts).parts:
        cursor /= part
        if cursor.is_symlink():
            raise ValueError(
                f"output path for {lang!r} contains a symlink: {cursor}"
            )
    output_root = lexical_output_root.resolve()
    language_root = lexical_language_root.resolve()
    if not language_root.is_relative_to(output_root):
        raise ValueError(
            f"language root for {lang!r} resolves outside translation output root"
        )
    target = lexical_target.resolve()
    if target != language_root and not target.is_relative_to(language_root):
        raise ValueError(f"output path for {lang!r} resolves outside language root")
    return target


# Inline span vocabulary, named once so the two protection lists compose from the
# same regexes instead of copy-pasting them.
INLINE_CODE = re.compile(
    r"(?<!`)(?P<ticks>`+)(?!`)(?P<body>[^\n]*?)(?<!`)(?P=ticks)(?!`)"
)
INLINE_MATH = re.compile(r"(?<!\\)\$[^$\n]+?(?<!\\)\$")
INLINE_DISPLAY_MATH = re.compile(r"(?<!\\)\$\$[^\n]*?(?<!\\)\$\$")
DOLLAR_VARIABLE_RE = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*")
DOLLAR_VARIABLE_EXPRESSION_RE = re.compile(
    r"\$[A-Za-z_][A-Za-z0-9_]*"
    r"(?:\s*(?:\*\*|//|[+*/×÷-])\s*"
    r"(?:\$[A-Za-z_][A-Za-z0-9_]*|\d[\d,]*(?:\.\d+)?)){1,}"
)
TABLE_SEPARATOR_RE = re.compile(r"^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$")
THEMATIC_OR_SETEXT_RE = re.compile(
    r"^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,}|=+)\s*$"
)
INLINE_HTML = re.compile(r"<!--.*?-->|</?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?/?>")
EMPHASIS = re.compile(
    r"\*\*[^*\n]+\*\*|__[^_\n]+__"
    r"|(?<![A-Za-z0-9_*])\*(?![\s*])[^*\n]*?\S\*(?![A-Za-z0-9_*])"
    r"|(?<![A-Za-z0-9_])_(?![\s_])[^_\n]*?\S_(?![A-Za-z0-9_])"
)
TECHNICAL_TOKEN = re.compile(
    r"(?<![A-Za-z0-9_])(?:[A-Z]{2,}[A-Za-z0-9.+-]*|[A-Za-z]*[a-z][A-Z][A-Za-z0-9.+-]*|"
    r"[A-Za-z]+\d[A-Za-z0-9.+-]*|Python|TypeScript|JavaScript|Rust|Julia|"
    r"PyTorch|TensorFlow|JAX|NumPy|Docker|Kubernetes|GitHub|Claude|Anthropic|"
    r"Gemini|Llama|Mistral|Qwen|HuggingFace|LangChain|LangGraph|CrewAI|"
    r"OpenClaw|Codex|OpenAI|DeepSeek|Linux|Windows|macOS|Apple|Git|HTTP|"
    r"HTTPS|JSON|YAML|SQL|HTML|CSS|API|SDK|CLI|GPU|CPU|TPU|MCP|LLM|AI)"
    r"(?![A-Za-z0-9_])"
)
# Whole-document protection for the LLM path.
PROTECT = [
    re.compile(r"```.*?\n.*?```", re.S),          # fenced code / figure / mermaid
    re.compile(r"~~~.*?\n.*?~~~", re.S),          # alt fenced
    re.compile(r"\$\$.*?\$\$", re.S),              # display math
    INLINE_CODE, INLINE_MATH,
]
SENTINEL = "⁣PROTECT{}⁣"  # invisible separator, unlikely in prose
SENT_RE = re.compile(r"⁣PROTECT\d+⁣")
PLACEHOLDER_FRAGMENT_RE = re.compile(
    r"⁣|(?<![A-Za-z0-9_])PROTECT\d+(?![A-Za-z0-9_])"
)
HAN_RE = re.compile(r"[\u3400-\u9fff]")
FENCE_LINE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
REFERENCE_DEFINITION_START_RE = re.compile(
    r"^ {0,3}\[((?:\\.|[^\[\]\\\n]){1,999})\]:[ \t]*(.*)$"
)
ENGLISH_WORD_RE = re.compile(r"[A-Za-z]+(?:[’'-][A-Za-z]+)?")
REPEATED_HAN_RE = re.compile(r"([\u3400-\u9fff]{1,4})\1{2,}")
QUALIFIED_IDENTIFIER_RE = re.compile(
    r"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$"
)
FORMULA_FRAGMENT_RE = re.compile(r"^[A-Za-z0-9_.,()+\-*/=<>\\| ]+$")
TECHNICAL_FORMULA_SPAN_RE = re.compile(
    r"(?<![A-Za-z0-9_])(?:"
    r"[A-Za-z][A-Za-z0-9_]*(?:\([^()\n]*\))?\s*"
    r"(?:<=|>=|!=|==|<|>|=)\s*"
    r"(?:-?\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9_]*(?:\([^()\n]*\))?)"
    r"|[A-Za-z][A-Za-z0-9_]*\([^()\n]*(?:<=|>=|!=|==|<|>)[^()\n]*\)"
    r")(?![A-Za-z0-9_])"
)
FORMULA_CONNECTOR_RE = re.compile(
    r"\s*(?:,\s*)?\b(?:and|or|where|when|if|for)\b", re.IGNORECASE
)
FORMULA_LHS_RE = re.compile(
    r"^[A-Za-z_][A-Za-z0-9_]*(?:\([^()\n]*\))?\s*"
    r"(?:<=|>=|!=|==|<|>|=)"
)
CALL_SIGNATURE_RE = re.compile(
    r"^[A-Za-z_][A-Za-z0-9_.]*\s*\([^()\n]*\)"
    r"(?:\s*->\s*[A-Za-z_][A-Za-z0-9_.\[\], |]*)?$"
)
IDENTIFIER_LIST_RE = re.compile(
    r"^[A-Za-z_][A-Za-z0-9_]*"
    r"(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*){2,}$"
)
ENUM_LIST_RE = re.compile(
    r"^[A-Za-z_][A-Za-z0-9_]*"
    r"(?:\s*\|\s*[A-Za-z_][A-Za-z0-9_]*){2,}$"
)
PRESERVED_ENUM_LISTS = frozenset({"pending | running | completed"})
SNAKE_IDENTIFIER_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")
PAREN_ARGUMENTS_RE = re.compile(
    r"^\(\s*[A-Za-z_][A-Za-z0-9_]*"
    r"(?:\s*=\s*(?:[A-Za-z0-9_.+-]+|[\"'][^\"']*[\"']))?"
    r"(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*"
    r"(?:\s*=\s*(?:[A-Za-z0-9_.+-]+|[\"'][^\"']*[\"']))?)*\s*\)$"
)
IDENTIFIER_SLASH_LIST_RE = re.compile(
    r"^[a-z][a-z0-9_.-]*(?:\s*/\s*[a-z][a-z0-9_.-]*)+$"
)
IDENTIFIER_COMMA_LIST_RE = re.compile(
    r"^[a-z][a-z0-9_.-]*(?:\s*,\s*[a-z][a-z0-9_./-]*)+$"
)
PRESERVED_NAMED_TERMS = frozenset(
    {
        "Artificial Analysis Speech",
        "At-least-once delivery",
        "Audio Flamingo Next",
        "Data Provenance Initiative",
        "Frontier Safety Framework",
        "Frontier Safety Roadmap",
        "Hugging Face tokenizers",
        "Instant Voice Clone",
        "Microsoft Agent Framework",
        "R&D autonomy level 1",
        "Stable Audio Open",
        "Stable Diffusion 3 Medium",
        "Stable Diffusion 3.5 Large",
    }
)


@dataclass(frozen=True)
class InlineSpan:
    start: int
    end: int
    kind: str
    raw: str
    label: str | None = None
    target: str | None = None
    target_start: int | None = None
    target_end: int | None = None


@dataclass(frozen=True)
class ReferenceDefinition:
    start: int
    end: int
    label: str
    destination: str
    title_marker: str | None
    lines: tuple[str, ...]


def _looks_like_currency_span(raw, following=""):
    """Distinguish two currency markers from a real ``$...$`` formula."""
    body = raw[1:-1].strip()
    if body.startswith("/"):
        return True
    if not body or not body[0].isdigit():
        return False
    amount = re.match(r"^\d[\d,]*(?:\.\d+)?(?:[kKmMbBtT])?", body)
    if amount is None:
        return False
    # The regex pairs the dollar signs of two ordinary prices. A digit right
    # after the apparent closing delimiter proves that delimiter starts the
    # second amount, even when the prose between them contains words such as
    # ``if`` or ``otherwise``.
    if following[:1].isdigit():
        return True
    rest = body[amount.end():]
    if not rest:
        return False
    # Numeric-leading conditional and qualified expressions are formulas when
    # the keyword immediately follows the leading value. Requiring that
    # position avoids treating a broad span between two prices, such as
    # ``$4 per run. If ... $50``, as mathematics.
    if re.match(
        r"^\s+(?:if|else|for|where|when|otherwise)\b",
        rest,
        re.IGNORECASE,
    ):
        return False
    if re.match(r"^\s*(?:\\[A-Za-z]+|[_^])", rest):
        return False
    # Numeric-leading algebra has an immediate identifier/subscript or an
    # arithmetic operator. Currency prose continues with a unit, punctuation,
    # natural-language description, or the next price marker.
    if re.match(r"^[A-Za-z_{}^\\]", rest):
        return False
    operator = re.match(r"^\s*([+*/=<>^-])\s*(\S.*)$", rest)
    if operator is not None:
        if operator.group(1) == "/" and re.match(
            r"^(?:hr|hour|day|month|mo|call|request|token|tokens|second|minute|year|M)\b",
            operator.group(2),
            re.IGNORECASE,
        ):
            return True
        if operator.group(1) == "-" and re.match(
            r"^\d[\d,.]*(?:[kKmMbBtT])?/(?:hr|hour|day|month|mo|call|request|token|tokens|second|minute|year)\b",
            operator.group(2),
            re.IGNORECASE,
        ):
            return True
        if operator.group(1) == "-" and re.match(
            r"^\d[\d,.]*(?:[kKmMbBtT])?\s+(?:per|each)\b",
            operator.group(2),
            re.IGNORECASE,
        ):
            return True
        if operator.group(1) == "-" and re.match(
            r"^(?:class|tier|grade)\b", operator.group(2), re.IGNORECASE
        ):
            return True
        suffix = operator.group(2)
        if not (
            operator.group(1) == "+"
            and re.match(r"^(?:per|each)\b", suffix, re.IGNORECASE)
        ):
            return False
    return True


def _mixed_formula_span(text, start):
    """Return a formula prefix followed by translatable connective prose."""
    tail = text[start:]
    for connector in FORMULA_CONNECTOR_RE.finditer(tail):
        candidate = tail[:connector.start()].rstrip()
        if not candidate:
            continue
        # A later connective can belong to the next sentence. Treating the
        # intervening prose as part of the formula leaves it untranslated and
        # makes target-side token boundaries depend on the target script.
        if re.search(r"[.!?][)\]\"']*\s+[A-Za-z]", candidate):
            continue
        if not FORMULA_LHS_RE.match(candidate):
            continue
        if not FORMULA_FRAGMENT_RE.fullmatch(candidate):
            continue
        return InlineSpan(start, start + len(candidate), "technical", candidate)
    return None


def _is_escaped(text, index):
    backslashes = 0
    index -= 1
    while index >= 0 and text[index] == "\\":
        backslashes += 1
        index -= 1
    return backslashes % 2 == 1


def _balanced_closer(text, opening_index, opener, closer):
    """Locate a same-line closer, respecting nesting and escapes."""
    depth = 0
    index = opening_index
    while index < len(text) and text[index] != "\n":
        char = text[index]
        if char == "\\":
            index += 2
            continue
        if char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def _markdown_destination_closer(text, opening_index):
    """Locate the outer ``)`` of an inline Markdown destination.

    An angle destination has its own delimiter pair. Parentheses inside
    ``<...>`` are URL bytes, not nesting for the surrounding ``(...)``.
    Keeping that distinction here also means the angle wrapper remains part of
    the protected target rather than being mistaken for Markdown syntax.
    """
    depth = 1
    index = opening_index + 1
    in_angle_destination = index < len(text) and text[index] == "<"
    angle_open = index if in_angle_destination else None
    while index < len(text) and text[index] != "\n":
        char = text[index]
        if char == "\\":
            index += 2
            continue
        if in_angle_destination:
            if char == "<" and index != angle_open:
                return None
            if char == ">":
                in_angle_destination = False
            index += 1
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def _markdown_link_at(text, start):
    image = text.startswith("![", start)
    label_open = start + 1 if image else start
    if (
        label_open >= len(text)
        or text[label_open] != "["
        or _is_escaped(text, start)
    ):
        return None
    label_close = _balanced_closer(text, label_open, "[", "]")
    if label_close is None or label_close + 1 >= len(text):
        return None
    destination_open = label_close + 1
    if text[destination_open] != "(" or _is_escaped(text, destination_open):
        return None
    destination_close = _markdown_destination_closer(text, destination_open)
    if destination_close is None:
        return None
    end = destination_close + 1
    return InlineSpan(
        start=start,
        end=end,
        kind="image" if image else "link",
        raw=text[start:end],
        label=text[label_open + 1:label_close],
        target=text[destination_open + 1:destination_close],
        target_start=destination_open + 1,
        target_end=destination_close,
    )


def _normalized_reference_label(label):
    return " ".join(label.split()).casefold()


def _reference_destination(value):
    """Return ``(destination, trailing text)`` for one definition line."""
    text = value.lstrip()
    if not text:
        return None
    if text.startswith("<"):
        index = 1
        while index < len(text):
            if text[index] == "\\":
                index += 2
                continue
            if text[index] == ">":
                return text[:index + 1], text[index + 1:]
            index += 1
        return None

    depth = 0
    index = 0
    while index < len(text):
        char = text[index]
        if char == "\\":
            index += 2
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            if depth == 0:
                break
            depth -= 1
        elif char.isspace() and depth == 0:
            break
        index += 1
    if index == 0 or depth != 0:
        return None
    return text[:index], text[index:]


def _reference_title_extent(lines, start, value):
    """Return ``(opening marker, final line)`` for a CommonMark title."""
    current = value.lstrip(" \t")
    if not current or current[0] not in {"\"", "'", "("}:
        return None
    opener = current[0]
    closer = ")" if opener == "(" else opener
    line_number = start
    cursor = 1
    while True:
        while cursor < len(current):
            char = current[cursor]
            if char == "\\":
                cursor += 2
                continue
            if opener == "(" and char == "(":
                return None
            if char == closer:
                if current[cursor + 1:].strip(" \t"):
                    return None
                return opener, line_number
            cursor += 1
        line_number += 1
        if (
            line_number >= len(lines)
            or not lines[line_number].strip(" \t")
        ):
            return None
        current = lines[line_number]
        cursor = 0


def reference_definitions(text):
    """Parse single- and multi-line CommonMark reference definitions."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    definitions = []
    fence = None
    in_mathblock = False
    index = 0
    while index < len(lines):
        line = lines[index]
        next_fence = fence_transition(line, fence)
        if next_fence != fence or fence is not None:
            fence = next_fence
            index += 1
            continue
        if is_display_math_line(line) and INLINE_DISPLAY_MATH.fullmatch(line.strip()):
            index += 1
            continue
        if is_display_math_delimiter(line):
            in_mathblock = not in_mathblock
            index += 1
            continue
        if in_mathblock:
            index += 1
            continue

        match = REFERENCE_DEFINITION_START_RE.match(line)
        if match is None:
            index += 1
            continue

        start = index
        end = index
        destination_line = match.group(2)
        if not destination_line.strip():
            if (
                index + 1 >= len(lines)
                or not lines[index + 1].strip(" \t")
            ):
                index += 1
                continue
            destination_line = lines[index + 1]
            end = index + 1

        parsed = _reference_destination(destination_line)
        if parsed is None:
            index += 1
            continue
        destination, trailing = parsed
        title_marker = None
        if trailing.strip(" \t"):
            # A same-line title must be separated from the destination. Any
            # other trailing character invalidates the entire definition.
            title = (
                _reference_title_extent(lines, end, trailing)
                if trailing.startswith((" ", "\t"))
                else None
            )
            if title is None:
                index += 1
                continue
            title_marker, end = title
        elif end + 1 < len(lines):
            title = _reference_title_extent(lines, end + 1, lines[end + 1])
            if title is not None:
                title_marker, end = title

        definitions.append(
            ReferenceDefinition(
                start=start,
                end=end,
                label=_normalized_reference_label(match.group(1)),
                destination=destination,
                title_marker=title_marker,
                lines=tuple(lines[start:end + 1]),
            )
        )
        index = end + 1
    return tuple(definitions)


def _markdown_reference_at(text, start, reference_labels):
    """Parse a defined full, collapsed, or shortcut reference link."""
    image = text.startswith("![", start)
    label_open = start + 1 if image else start
    if (
        label_open >= len(text)
        or text[label_open] != "["
        or _is_escaped(text, start)
    ):
        return None
    label_close = _balanced_closer(text, label_open, "[", "]")
    if label_close is None:
        return None

    label = text[label_open + 1:label_close]
    reference = label
    end = label_close + 1
    collapsed_or_shortcut = True
    if end < len(text) and text[end] == "[" and not _is_escaped(text, end):
        reference_close = _balanced_closer(text, end, "[", "]")
        if reference_close is None:
            return None
        explicit = text[end + 1:reference_close]
        reference = explicit or label
        end = reference_close + 1
        collapsed_or_shortcut = not explicit

    if _normalized_reference_label(reference) not in reference_labels:
        return None
    return InlineSpan(
        start=start,
        end=end,
        kind="reference-image" if image else "reference-link",
        raw=text[start:end],
        label=None if collapsed_or_shortcut else label,
        target=reference,
    )


def _bare_url_end(text, start):
    """Return the end of a bare URL with balanced/escaped parentheses."""
    index = start
    depth = 0
    while index < len(text):
        char = text[index]
        if (
            char.isspace()
            or ord(char) > 127
            or char in "<>。，；：！？、（）【】《》「」『』"
        ):
            break
        if char == "\\" and index + 1 < len(text):
            index += 2
            continue
        if char == "(":
            depth += 1
        elif char == ")":
            if depth == 0:
                break
            depth -= 1
        elif char == "]" and depth == 0:
            break
        index += 1
    while index > start and text[index - 1] in ".,;:!?":
        index -= 1
    return index


def inline_spans(text, reference_labels=frozenset()):
    """Yield protected/structured inline Markdown spans from left to right."""
    index = 0
    while index < len(text):
        span = None
        if text.startswith("![", index) or text[index] == "[":
            span = _markdown_link_at(text, index)
            if span is None and reference_labels:
                span = _markdown_reference_at(text, index, reference_labels)
        if span is None:
            match = INLINE_DISPLAY_MATH.match(text, index)
            kind = "inline-math"
            if match is None:
                variable_expression = DOLLAR_VARIABLE_EXPRESSION_RE.match(
                    text, index
                )
                if (
                    variable_expression is not None
                    and len(
                        DOLLAR_VARIABLE_RE.findall(
                            variable_expression.group(0)
                        )
                    )
                    >= 2
                ):
                    match = variable_expression
            if match is None:
                match = INLINE_CODE.match(text, index)
                kind = "inline-code"
            if match is None:
                match = INLINE_MATH.match(text, index)
                kind = "inline-math"
                if match is not None and _looks_like_currency_span(
                    match.group(0), text[match.end() : match.end() + 1]
                ):
                    # Skip only this currency marker. The amount and prose stay
                    # visible, and nested code/URLs are still scanned. A later
                    # price marker is classified independently instead of being
                    # paired as fake math.
                    index += 1
                    continue
            if match is None:
                match = EMPHASIS.match(text, index)
                kind = "emphasis"
            if match is None:
                match = INLINE_HTML.match(text, index)
                kind = "inline-html"
            if match is not None:
                raw = match.group(0)
                if kind == "emphasis":
                    marker = _emphasis_marker(raw)
                    label = raw[len(marker):-len(marker)]
                else:
                    label = None
                span = InlineSpan(index, match.end(), kind, raw, label=label)
        if span is None and text.startswith(("http://", "https://"), index):
            end = _bare_url_end(text, index)
            span = InlineSpan(index, end, "url", text[index:end])
        if span is None:
            span = _mixed_formula_span(text, index)
        if span is None:
            match = TECHNICAL_FORMULA_SPAN_RE.match(text, index)
            if match is not None:
                span = InlineSpan(
                    index, match.end(), "technical", match.group(0)
                )
        if span is None:
            match = TECHNICAL_TOKEN.match(text, index)
            if match is not None:
                span = InlineSpan(index, match.end(), "technical", match.group(0))
        if span is None or span.end <= index:
            index += 1
            continue
        yield span
        index = span.end


def _reference_definition_labels(text):
    """Collect source reference labels outside fenced and math blocks."""
    return frozenset(definition.label for definition in reference_definitions(text))


def _emphasis_marker(raw):
    return raw[:2] if raw.startswith(("**", "__")) else raw[:1]


def protect(text, patterns=None):
    store = []
    definitions = reference_definitions(text)
    reference_labels = frozenset(definition.label for definition in definitions)
    definition_lines = {
        line_number: definition
        for definition in definitions
        for line_number in range(definition.start, definition.end + 1)
    }

    def stash(m):
        store.append(m.group(0))
        return SENTINEL.format(len(store) - 1)

    # Explicit pattern callers retain the generic substitution contract.
    if patterns is not None:
        for pat in patterns:
            text = pat.sub(stash, text)
        return text, store

    def protect_inline(value, *, protect_images=True):
        rebuilt = []
        cursor = 0
        for span in inline_spans(value, reference_labels):
            rebuilt.append(value[cursor:span.start])
            if span.kind == "link":
                rebuilt.append(
                    "["
                    + protect_inline(span.label or "", protect_images=protect_images)
                    + "]("
                )
                store.append(span.target or "")
                rebuilt.append(SENTINEL.format(len(store) - 1) + ")")
            elif span.kind == "image":
                if protect_images:
                    store.append(span.raw)
                    rebuilt.append(SENTINEL.format(len(store) - 1))
                else:
                    rebuilt.append(
                        "!["
                        + protect_inline(span.label or "", protect_images=False)
                        + "]("
                    )
                    store.append(span.target or "")
                    rebuilt.append(SENTINEL.format(len(store) - 1) + ")")
            elif span.kind in {"reference-link", "reference-image"}:
                if span.label is None:
                    store.append(span.raw)
                    rebuilt.append(SENTINEL.format(len(store) - 1))
                else:
                    prefix = "![" if span.kind == "reference-image" else "["
                    rebuilt.append(
                        prefix
                        + protect_inline(span.label, protect_images=protect_images)
                        + "]["
                    )
                    store.append(span.target or "")
                    rebuilt.append(SENTINEL.format(len(store) - 1) + "]")
            elif span.kind == "emphasis":
                marker = _emphasis_marker(span.raw)
                rebuilt.append(
                    marker
                    + protect_inline(span.label or "", protect_images=protect_images)
                    + marker
                )
            else:
                store.append(span.raw)
                rebuilt.append(SENTINEL.format(len(store) - 1))
            cursor = span.end
        rebuilt.append(value[cursor:])
        return "".join(rebuilt)

    # Protect block spans first using the same fence semantics as the markdown
    # walker. This keeps four-backtick outer fences intact even when they
    # contain literal triple-backtick lines.
    block_store = []
    placeholders = []
    prose = []
    fenced = []
    math_block = []
    fence = None
    in_mathblock = False

    def stash_block(value):
        block_store.append(value)
        placeholders.append(f"⁢{len(block_store) - 1}⁢")

    def flush_prose():
        if not prose:
            return
        placeholders.append(protect_inline("".join(prose), protect_images=True))
        prose.clear()

    for line_number, line in enumerate(text.splitlines(keepends=True)):
        if fence is not None:
            fenced.append(line)
            next_fence = fence_transition(line, fence)
            if next_fence is None:
                stash_block("".join(fenced))
                fenced = []
                fence = None
            continue

        if in_mathblock:
            math_block.append(line)
            if is_display_math_line(line) and is_display_math_delimiter(line):
                stash_block("".join(math_block))
                math_block = []
                in_mathblock = False
            continue

        next_fence = fence_transition(line, fence)
        if next_fence is not None:
            flush_prose()
            fence = next_fence
            fenced = [line]
            continue

        if is_display_math_delimiter(line):
            flush_prose()
            in_mathblock = True
            math_block = [line]
            continue

        if line_number in definition_lines:
            flush_prose()
            stash_block(line)
            continue

        prose.append(line)

    if fenced:
        stash_block("".join(fenced))
    if math_block:
        stash_block("".join(math_block))
    flush_prose()
    text = "".join(placeholders)
    for index, value in enumerate(block_store):
        store.append(value)
        text = text.replace(
            f"⁢{index}⁢", SENTINEL.format(len(store) - 1)
        )
    return text, store


def protect_inline_destinations(text):
    """Protect balanced link/image targets and bare URLs, not visible labels."""
    store = []
    rebuilt = []
    cursor = 0
    for span in inline_spans(text):
        rebuilt.append(text[cursor:span.start])
        if span.kind in {"link", "image"}:
            prefix = "![" if span.kind == "image" else "["
            rebuilt.append(prefix + (span.label or "") + "](")
            store.append(span.target or "")
            rebuilt.append(SENTINEL.format(len(store) - 1) + ")")
        elif span.kind == "url":
            store.append(span.raw)
            rebuilt.append(SENTINEL.format(len(store) - 1))
        else:
            rebuilt.append(span.raw)
        cursor = span.end
    rebuilt.append(text[cursor:])
    return "".join(rebuilt), store


def restore(text, store):
    # reverse order so a span that itself contains a lower-indexed sentinel
    # (e.g. a link whose url was protected first) resolves correctly.
    for i in range(len(store) - 1, -1, -1):
        text = text.replace(SENTINEL.format(i), store[i])
    return text


def placeholder_sequence_is_valid(protected, translated):
    """Return whether provider output preserved placeholder tokens exactly."""
    expected = SENT_RE.findall(protected)
    actual = SENT_RE.findall(translated)
    if actual != expected:
        return False
    residue = SENT_RE.sub("", translated)
    return PLACEHOLDER_FRAGMENT_RE.search(residue) is None


def has_protection_sentinel_residue(text):
    """Detect complete or damaged placeholders left in translated text."""
    return PLACEHOLDER_FRAGMENT_RE.search(text) is not None


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
    model = translation_model("anthropic")
    msg = client.messages.create(
        model=model, max_tokens=8192,
        system=system, messages=[{"role": "user", "content": text}],
    )
    return "".join(b.text for b in msg.content if b.type == "text")


def _openai(system, text):
    from openai import OpenAI  # noqa

    client = OpenAI(api_key=os.environ["LLM_API_KEY"])
    model = translation_model("openai")
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
META_RE = re.compile(
    r"^\s*\*\*(Type|Language|Languages|Prerequisites|Phases exercised|Time|Related):\*\*"
)
MARKER_RE = re.compile(r"^(\s*)((?:#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)*)(.*)$")
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _nllb_pipe(tgt):
    if tgt not in _NLLB:
        from transformers import AutoModelForSeq2SeqLM, NllbTokenizer  # noqa
        model = translation_model("nllb")
        tokenizer = NllbTokenizer.from_pretrained(
            model, src_lang="eng_Latn", tgt_lang=tgt
        )
        network = AutoModelForSeq2SeqLM.from_pretrained(model).eval()

        def translate(batch):
            import torch  # noqa

            values = [batch] if isinstance(batch, str) else list(batch)
            encoded = tokenizer(
                values, return_tensors="pt", padding=True, truncation=True, max_length=512
            )
            with torch.inference_mode():
                generated = network.generate(
                    **encoded,
                    forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt),
                    max_new_tokens=512,
                )
            decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)
            return [{"translation_text": value} for value in decoded]

        _NLLB[tgt] = translate
    return _NLLB[tgt]


def _nllb_sentence(pipe, text):
    # NLLB truncates past ~512 tokens; split long fragments by sentence.
    if len(text) <= 400:
        return pipe(text)[0]["translation_text"]
    return " ".join(pipe(s)[0]["translation_text"] for s in SENT_SPLIT.split(text) if s.strip())


def _nllb_batch(pipe, texts):
    """Translate short independent fragments in one model invocation."""
    values = list(texts)
    if not values:
        return []
    records = pipe(values)
    return [record["translation_text"] for record in records]


def _translate_visible_plain(text, translate_fn):
    """Translate a visible prose fragment while retaining surrounding space."""
    match = re.match(r"^(\s*)(.*?)(\s*)$", text, re.S)
    if match is None:
        return text
    leading, body, trailing = match.groups()
    if not visible_plain_needs_translation(body):
        return text
    return leading + translate_fn(body) + trailing


def _translate_unmatched_backtick_prefix(text, translate_fn):
    """Keep unmatched leading backtick runs while translating their prose."""
    malformed_fence = re.match(r"^(`{3,}[^`\n]*`)(.*)$", text, re.S)
    if malformed_fence is not None:
        prefix, remainder = malformed_fence.groups()
        return prefix + _translate_visible_plain(remainder, translate_fn)
    match = re.match(r"^(`+)(.*)$", text, re.S)
    if match is None:
        return _translate_visible_plain(text, translate_fn)
    ticks, remainder = match.groups()
    return ticks + _translate_visible_plain(remainder, translate_fn)


def visible_plain_needs_translation(text):
    """Return whether plain visible text is prose rather than a terse token."""
    if is_technical_fragment(text):
        return False
    words = ENGLISH_WORD_RE.findall(text)
    if not words:
        return False
    if re.match(r"^\s*(?:<=|>=|!=|==|=|<|>)", text) and words:
        return True
    if len(words) == 1 and (
        words[0].isupper()
        or any(char.isupper() for char in words[0][1:])
        or re.fullmatch(
            r"\s*[+-]?\d[\d,.]*(?:\.\d+)?\s*"
            r"[A-Za-z%µμ][A-Za-z0-9%µμ./^-]*\s*",
            text,
        )
    ):
        return False
    return True


def is_technical_fragment(text):
    """Return whether visible ASCII text is an identifier or math expression.

    These fragments may contain several English-looking names, but translating
    them would corrupt executable identifiers or formulas rather than localize
    prose.
    """
    body = text.strip()
    if body in PRESERVED_NAMED_TERMS:
        return True
    if QUALIFIED_IDENTIFIER_RE.fullmatch(body):
        return True
    if SNAKE_IDENTIFIER_RE.fullmatch(body):
        return True
    if CALL_SIGNATURE_RE.fullmatch(body) and not re.search(r"\s\(", body):
        return True
    if PAREN_ARGUMENTS_RE.fullmatch(body):
        return True
    if IDENTIFIER_LIST_RE.fullmatch(body) and "_" in body:
        return True
    if body in PRESERVED_ENUM_LISTS:
        return True
    if IDENTIFIER_SLASH_LIST_RE.fullmatch(body) and any(
        marker in body for marker in ("_", ".")
    ):
        return True
    if IDENTIFIER_COMMA_LIST_RE.fullmatch(body) and any(
        marker in body for marker in ("/", "_", ".", "-")
    ):
        return True
    if not FORMULA_FRAGMENT_RE.fullmatch(body):
        return False
    words = ENGLISH_WORD_RE.findall(body)
    if re.match(r"^(?:<=|>=|!=|==|=|<|>)", body) and words:
        return False
    if len(words) > 6 and "_" not in body:
        return False
    if re.search(
        r"\b(?:and|for|from|of|or|the|to|with)\b", body, re.IGNORECASE
    ):
        return False
    return any(operator in body for operator in ("+", "*", "=", "<", ">"))


def technical_contract_value(text):
    """Return an exact technical fragment skipped by the NLLB walker."""
    body = text.strip()
    return ("technical-contract", body) if is_technical_fragment(body) else None


def technical_contract_values(text):
    """Return exact technical plain-text spans, excluding Markdown syntax."""
    values = []
    for part in extract_visible_plain_parts(text):
        technical = technical_contract_value(part)
        if technical is not None:
            values.append(technical)
    return values


def extract_visible_plain_parts(text):
    """Yield visible plain-text regions, descending into labels/emphasis."""
    parts = []
    cursor = 0
    for span in inline_spans(text):
        parts.append(text[cursor:span.start])
        if span.kind in {"image", "link", "emphasis"}:
            parts.extend(extract_visible_plain_parts(span.label or ""))
        cursor = span.end
    parts.append(text[cursor:])
    return parts


def reference_visible_parts(text):
    """Return prose after a leading reference link, omitting its title."""
    first = len(text) - len(text.lstrip())
    span = _markdown_link_at(text, first)
    if span is None or span.kind != "link":
        return extract_visible_plain_parts(text)
    parts = extract_visible_plain_parts(text[span.end:])
    if parts:
        parts[0] = re.sub(r"^\s*(?:[-–—:]\s*)+", "", parts[0])
    return parts


def translate_inline_visible(text, translate_fn, reference_labels=frozenset()):
    """Translate visible Markdown text while preserving syntax and targets."""
    out = []
    cursor = 0
    for span in inline_spans(text, reference_labels):
        out.append(
            _translate_unmatched_backtick_prefix(
                text[cursor:span.start], translate_fn
            )
        )
        if span.kind == "image":
            out.append(
                f"![{translate_inline_visible(span.label or '', translate_fn, reference_labels)}]"
                f"({span.target})"
            )
        elif span.kind == "link":
            out.append(
                f"[{translate_inline_visible(span.label or '', translate_fn, reference_labels)}]"
                f"({span.target})"
            )
        elif span.kind in {"reference-link", "reference-image"}:
            prefix = "![" if span.kind == "reference-image" else "["
            if span.label is None:
                out.append(span.raw)
            else:
                out.append(
                    prefix
                    + translate_inline_visible(
                        span.label, translate_fn, reference_labels
                    )
                    + f"][{span.target}]"
                )
        elif span.kind == "emphasis":
            marker = _emphasis_marker(span.raw)
            out.append(
                marker
                + translate_inline_visible(
                    span.label or "", translate_fn, reference_labels
                )
                + marker
            )
        else:
            out.append(span.raw)
        cursor = span.end
    out.append(_translate_unmatched_backtick_prefix(text[cursor:], translate_fn))
    return "".join(out)


def protected_inline_values(
    text, *, include_technical=True, reference_labels=frozenset()
):
    """Return inline literals and destinations that translation must retain."""
    values = []
    for span in inline_spans(text, reference_labels):
        if span.kind in {"image", "link", "reference-link", "reference-image"}:
            values.append((f"{span.kind}-target", span.target))
            if span.label is not None:
                values.extend(
                    protected_inline_values(
                        span.label,
                        include_technical=include_technical,
                        reference_labels=reference_labels,
                    )
                )
        elif span.kind == "emphasis":
            values.extend(
                protected_inline_values(
                    span.label or "",
                    include_technical=include_technical,
                    reference_labels=reference_labels,
                )
            )
        elif span.kind in {
            "inline-code",
            "inline-math",
            "inline-html",
            "url",
        }:
            values.append((span.kind, span.raw))
        elif span.kind == "technical" and include_technical:
            values.append((span.kind, span.raw))
    return values


def protected_document_values(text):
    """Collect explicitly marked immutable Markdown content.

    Unlike ``nllb_protected_segments``, this representation has no positional
    contract.  Human translators may move prose and its technical spans while
    every source-side fenced block, code/math span, URL, and destination must
    still occur. Unmarked identifiers and formulas remain visible prose: a
    human translation may add annotations or localize their surrounding form.
    """
    values = []
    definitions = reference_definitions(text)
    reference_labels = frozenset(definition.label for definition in definitions)
    definitions_by_start = {definition.start: definition for definition in definitions}
    definition_lines = {
        line_number
        for definition in definitions
        for line_number in range(definition.start, definition.end + 1)
    }
    fence = None
    fenced = []
    in_mathblock = False
    math_block = []

    def collect_line(value):
        values.extend(
            protected_inline_values(
                value,
                include_technical=False,
                reference_labels=reference_labels,
            )
        )

    for line_number, line in enumerate(text.splitlines(keepends=True)):
        if fence is not None:
            fenced.append(line)
            next_fence = fence_transition(line, fence)
            if next_fence is None:
                values.append(("fenced-block", "".join(fenced)))
                fenced = []
                fence = None
            continue

        next_fence = fence_transition(line)
        if next_fence is not None:
            fence = next_fence
            fenced = [line]
            continue

        if in_mathblock:
            math_block.append(line)
            if is_display_math_delimiter(line):
                values.append(("display-math", "".join(math_block)))
                math_block = []
                in_mathblock = False
            continue

        if is_display_math_delimiter(line):
            in_mathblock = True
            math_block = [line]
            continue

        reference = definitions_by_start.get(line_number)
        if reference is not None:
            values.append(
                (
                    "reference-destination",
                    reference.label,
                    reference.destination,
                )
            )
            continue
        if line_number in definition_lines:
            continue

        if line.lstrip().startswith("|"):
            for part in split_table_row(line):
                if part != "|":
                    collect_line(part)
        else:
            collect_line(line)

    if fenced:
        values.append(("unclosed-fenced-block", "".join(fenced)))
    if math_block:
        values.append(("unclosed-display-math", "".join(math_block)))
    return tuple(values)


def protected_content_is_preserved(src, out):
    """Return whether all immutable values survive, allowing reordering."""
    source = src.replace("\r\n", "\n").replace("\r", "\n")
    target = out.replace("\r\n", "\n").replace("\r", "\n")
    source_values = Counter(protected_document_values(source))
    target_values = Counter(protected_document_values(target))
    return not source_values - target_values


def replace_visible_literal(text, source, replacement):
    """Replace a literal only in visible prose and link/image labels."""
    rebuilt = []
    cursor = 0
    for span in inline_spans(text):
        rebuilt.append(text[cursor:span.start].replace(source, replacement))
        if span.kind in {"link", "image"}:
            prefix = "![" if span.kind == "image" else "["
            rebuilt.append(
                prefix
                + replace_visible_literal(span.label or "", source, replacement)
                + f"]({span.target})"
            )
        elif span.kind == "emphasis":
            marker = _emphasis_marker(span.raw)
            rebuilt.append(
                marker
                + replace_visible_literal(span.label or "", source, replacement)
                + marker
            )
        else:
            rebuilt.append(span.raw)
        cursor = span.end
    rebuilt.append(text[cursor:].replace(source, replacement))
    return "".join(rebuilt)


def split_table_row(line):
    """Split a Markdown table row on pipes outside code spans."""
    parts, start, ticks, escaped = [], 0, 0, False
    index = 0
    while index < len(line):
        char = line[index]
        if escaped:
            escaped = False
            index += 1
            continue
        if char == "\\":
            escaped = True
            index += 1
            continue
        if char == "`":
            run = 1
            while index + run < len(line) and line[index + run] == "`":
                run += 1
            ticks = 0 if ticks == run else (run if ticks == 0 else ticks)
            index += run
            continue
        if char == "|" and ticks == 0:
            parts.append(line[start:index])
            parts.append("|")
            start = index + 1
        index += 1
    parts.append(line[start:])
    return parts


def translate_table_row(line, translate_fn, reference_labels=frozenset()):
    """Translate table-cell text without changing pipe or inline structure."""
    if TABLE_SEPARATOR_RE.fullmatch(line):
        return line
    return "".join(
        part
        if part == "|"
        else translate_inline_visible(part, translate_fn, reference_labels)
        for part in split_table_row(line)
    )


def fence_transition(line, fence=None):
    """Return the active CommonMark fence after consuming *line*.

    The marker character and opening length matter: a triple-backtick literal
    inside a four-backtick block is content, not a closing delimiter.
    """
    match = FENCE_LINE_RE.match(line)
    if not match:
        return fence
    marker, suffix = match.groups()
    if fence is None:
        if marker[0] == "`" and "`" in suffix:
            return None
        return (marker[0], len(marker))
    char, length = fence
    if marker[0] == char and len(marker) >= length and not suffix.strip():
        return None
    return fence


def is_display_math_delimiter(line):
    """Return whether a line opens or closes a multi-line ``$$`` block.

    A self-contained ``$$ expression $$`` line must not change the state for
    following prose.
    """
    stripped = line.strip()
    return stripped.startswith("$$") and stripped.count("$$") == 1


def is_display_math_line(line):
    """Return whether *line* starts a display-math span or delimiter."""
    return line.strip().startswith("$$")


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
    definitions = reference_definitions(src)
    reference_labels = frozenset(definition.label for definition in definitions)
    definition_lines = {
        line_number
        for definition in definitions
        for line_number in range(definition.start, definition.end + 1)
    }
    fence = None
    in_mathblock = False
    for line_number, line in enumerate(src.split("\n")):
        s = line.lstrip()
        next_fence = fence_transition(line, fence)
        if next_fence != fence or fence is not None:
            fence = next_fence
            out_lines.append(line)
            continue
        if is_display_math_line(line) and INLINE_DISPLAY_MATH.fullmatch(line.strip()):
            out_lines.append(line)
            continue
        if is_display_math_line(line) and not INLINE_DISPLAY_MATH.match(line):
            if is_display_math_delimiter(line):
                in_mathblock = not in_mathblock
            out_lines.append(line)
            continue
        # Verbatim: code/math blocks, blanks, raw-HTML lines, and metadata.
        # Tables and inline Markdown keep their syntax/targets while translating
        # user-visible cell and label text.
        if in_mathblock or not line.strip() or s.startswith("<") or META_RE.match(line):
            out_lines.append(line)
            continue
        if line_number in definition_lines:
            out_lines.append(line)
            continue
        if s.startswith("|"):
            out_lines.append(
                translate_table_row(line, translate_fn, reference_labels)
            )
            continue

        m = MARKER_RE.match(line)
        if m is None:
            out_lines.append(line)
            continue
        indent, markers, body = m.group(1), m.group(2), m.group(3)
        out_lines.append(
            indent
            + markers
            + translate_inline_visible(body, translate_fn, reference_labels)
        )
    return "\n".join(out_lines)


def translate_untranslated_table_cells(src, out, translate_many):
    """Translate English table cells still copied verbatim in *out*.

    Existing Chinese cells are left untouched. Only a target cell equal to its
    canonical English counterpart is eligible, which makes this safe for
    incremental upgrades of the historical translations branch.
    """
    source_lines = src.split("\n")
    target_lines = out.split("\n")
    if len(source_lines) != len(target_lines):
        raise ValueError("source and translation line counts differ")

    pending = []
    plans = {}
    fence = None
    in_mathblock = False
    for line_number, (source_line, target_line) in enumerate(
        zip(source_lines, target_lines)
    ):
        next_fence = fence_transition(source_line, fence)
        if next_fence != fence or fence is not None:
            fence = next_fence
            continue
        if is_display_math_line(source_line):
            if is_display_math_delimiter(source_line):
                in_mathblock = not in_mathblock
            continue
        if in_mathblock:
            continue
        if not source_line.lstrip().startswith("|") or TABLE_SEPARATOR_RE.fullmatch(source_line):
            continue
        source_parts = split_table_row(source_line)
        target_parts = split_table_row(target_line)
        if len(source_parts) != len(target_parts):
            raise ValueError(f"table column count differs at line {line_number + 1}")
        indices = []
        for index, (source_part, target_part) in enumerate(zip(source_parts, target_parts)):
            if source_part == "|" or source_part.strip() != target_part.strip():
                continue
            fragments = []

            def collect(fragment):
                fragments.append(fragment)
                return fragment

            translate_inline_visible(source_part, collect)
            if not fragments:
                continue
            start = len(pending)
            pending.extend(fragments)
            indices.append((index, source_part, start, len(fragments)))
        if indices:
            plans[line_number] = (target_parts, indices)

    translated = translate_many(pending)
    if len(translated) != len(pending):
        raise ValueError("table translator returned the wrong number of fragments")
    for line_number, (parts, indices) in plans.items():
        for index, source_part, start, count in indices:
            replacements = iter(translated[start:start + count])
            parts[index] = translate_inline_visible(
                source_part, lambda _fragment: next(replacements)
            )
        target_lines[line_number] = "".join(parts)
    return "\n".join(target_lines), len(pending)


def translate_untranslated_visible_fragments(src, out, translate_many):
    """Translate source prose fragments still present on the matching target line.

    This is an incremental migration helper for historical translations. It
    ignores tables (handled separately), metadata, raw HTML, code fences, and
    display math, while allowing visible emphasis and link labels to be
    localized without changing their delimiters or destinations.
    """
    source_lines = src.split("\n")
    target_lines = out.split("\n")
    if len(source_lines) != len(target_lines):
        raise ValueError("source and translation line counts differ")

    pending = []
    plans = {}
    fence = None
    in_mathblock = False
    for line_index, (source_line, target_line) in enumerate(
        zip(source_lines, target_lines)
    ):
        stripped = source_line.lstrip()
        next_fence = fence_transition(source_line, fence)
        if next_fence != fence or fence is not None:
            fence = next_fence
            continue
        if is_display_math_line(source_line):
            if is_display_math_delimiter(source_line):
                in_mathblock = not in_mathblock
            continue
        if (
            in_mathblock
            or not source_line.strip()
            or stripped.startswith(("|", "<"))
            or META_RE.match(source_line)
        ):
            continue

        source_match = MARKER_RE.match(source_line)
        target_match = MARKER_RE.match(target_line)
        if source_match is None or target_match is None:
            continue
        target_body = target_match.group(3)
        fragments = []
        for source_fragment in extract_visible_plain_parts(source_match.group(3)):
            body = source_fragment.strip()
            if visible_plain_needs_translation(body) and body in target_body:
                fragments.append(body)
        if not fragments:
            continue
        start = len(pending)
        pending.extend(fragments)
        plans[line_index] = (target_match, fragments, start)

    translated = translate_many(pending)
    if len(translated) != len(pending):
        raise ValueError("visible-text translator returned the wrong fragment count")
    for line_index, (match, fragments, start) in plans.items():
        replacements = dict(
            zip(fragments, translated[start:start + len(fragments)])
        )

        def replace_plain(part):
            updated = part
            for source_fragment in sorted(replacements, key=len, reverse=True):
                updated = replace_visible_literal(
                    updated, source_fragment, replacements[source_fragment]
                )
            return updated

        body = translate_inline_visible(match.group(3), replace_plain)
        target_lines[line_index] = match.group(1) + match.group(2) + body
    return "\n".join(target_lines), len(pending)


def nllb_protected_segments(text):
    """Collect content that the prose-only NLLB walker must not change."""
    segments = []
    fence = None
    fenced = []
    in_mathblock = False
    for line in text.splitlines():
        stripped = line.lstrip()
        if fence is not None:
            fenced.append(line)
            next_fence = fence_transition(line, fence)
            if next_fence is None:
                segments.append(("fenced-block", "\n".join(fenced)))
                fenced = []
                fence = None
            continue
        next_fence = fence_transition(line)
        if next_fence is not None:
            fence = next_fence
            fenced = [line]
            continue
        if is_display_math_line(line) and INLINE_DISPLAY_MATH.fullmatch(line.strip()):
            segments.append(("display-math", line))
            continue
        if is_display_math_line(line) and not INLINE_DISPLAY_MATH.match(line):
            kind = "display-math-delimiter"
            segments.append((kind, line))
            if is_display_math_delimiter(line):
                in_mathblock = not in_mathblock
            continue
        if in_mathblock:
            segments.append(("display-math", line))
            continue
        if stripped.startswith("|"):
            segments.append(("table-columns", str(len(split_table_row(line)))))
            segments.extend(
                ("inline", value)
                for value in protected_inline_values(
                    line, include_technical=False
                )
            )
            continue
        if stripped.startswith("<"):
            segments.append(("html", line))
            continue
        metadata = META_RE.match(line)
        if metadata:
            # Metadata labels are part of the lesson contract and stay in
            # English. Human-maintained translations may localize the visible
            # values, so protect only the label plus literal inline spans.
            segments.append(("metadata-key", metadata.group(1)))
            segments.extend(
                ("inline", value)
                for value in protected_inline_values(
                    line[metadata.end():], include_technical=False
                )
            )
            continue
        segments.extend(
            ("inline", value)
            for value in protected_inline_values(line, include_technical=False)
        )
    if fenced:
        segments.append(("unclosed-fenced-block", "\n".join(fenced)))
    return tuple(segments)


def protected_sequence_is_preserved(expected, actual):
    """Match source items exactly while ignoring unrelated target items.

    A target-language model may emit new text that happens to resemble an
    inline code or math span. Those additions are not source corruption unless
    they duplicate a source value. Source values must retain order and count.
    """
    required = tuple(expected)
    source_values = set(required)
    present = tuple(item for item in actual if item in source_values)
    return present == required


def _nllb_aligned_visible_parts(src, out):
    """Return source/target prose parts after enforcing walker structure.

    Classification is deliberately source-driven. Target-language text may
    contain Markdown-like characters, but it cannot move source content across
    a line or table-cell boundary. Lines the walker never translates must stay
    byte-identical.
    """
    source = src.replace("\r\n", "\n").replace("\r", "\n")
    target = out.replace("\r\n", "\n").replace("\r", "\n")
    source_lines = source.split("\n")
    target_lines = target.split("\n")
    if len(source_lines) != len(target_lines):
        return None

    pairs = []
    definitions = reference_definitions(source)
    reference_labels = frozenset(definition.label for definition in definitions)
    definition_lines = {
        line_number
        for definition in definitions
        for line_number in range(definition.start, definition.end + 1)
    }
    fence = None
    in_mathblock = False
    for line_number, (source_line, target_line) in enumerate(
        zip(source_lines, target_lines)
    ):
        next_fence = fence_transition(source_line, fence)
        if next_fence != fence or fence is not None:
            if source_line != target_line:
                return None
            fence = next_fence
            continue

        if (
            is_display_math_line(source_line)
            and INLINE_DISPLAY_MATH.fullmatch(source_line.strip())
        ):
            if source_line != target_line:
                return None
            continue
        if is_display_math_line(source_line) and not INLINE_DISPLAY_MATH.match(
            source_line
        ):
            if source_line != target_line:
                return None
            if is_display_math_delimiter(source_line):
                in_mathblock = not in_mathblock
            continue
        if in_mathblock:
            if source_line != target_line:
                return None
            continue

        if (
            not source_line.strip()
            or source_line.lstrip().startswith("<")
            or META_RE.match(source_line)
            or TABLE_SEPARATOR_RE.fullmatch(source_line)
        ):
            if source_line != target_line:
                return None
            continue
        if line_number in definition_lines:
            if source_line != target_line:
                return None
            continue

        if source_line.lstrip().startswith("|"):
            if not target_line.lstrip().startswith("|"):
                return None
            if bool(TABLE_SEPARATOR_RE.fullmatch(source_line)) != bool(
                TABLE_SEPARATOR_RE.fullmatch(target_line)
            ):
                return None
            source_parts = split_table_row(source_line)
            target_parts = split_table_row(target_line)
            if len(source_parts) != len(target_parts):
                return None
            for source_part, target_part in zip(source_parts, target_parts):
                if (
                    source_part != "|"
                    and source_part.strip()
                    and not target_part.strip()
                ):
                    return None
            pairs.extend(
                (source_part, target_part, reference_labels)
                for source_part, target_part in zip(source_parts, target_parts)
                if source_part != "|"
            )
            continue

        if (
            fence_transition(target_line) is not None
            or target_line.lstrip().startswith(("<", "|"))
            or META_RE.match(target_line)
            or REFERENCE_DEFINITION_START_RE.match(target_line)
        ):
            return None

        source_match = MARKER_RE.match(source_line)
        target_match = MARKER_RE.match(target_line)
        if source_match is None or target_match is None:
            return None
        if source_match.group(1, 2) != target_match.group(1, 2):
            return None
        if source_match.group(3).strip() and not target_match.group(3).strip():
            return None
        source_thematic = bool(
            THEMATIC_OR_SETEXT_RE.fullmatch(source_match.group(3))
        )
        target_thematic = bool(
            THEMATIC_OR_SETEXT_RE.fullmatch(target_match.group(3))
        )
        if source_thematic != target_thematic:
            return None
        if source_thematic and source_line != target_line:
            return None
        source_display = is_display_math_line(source_match.group(3))
        target_display = is_display_math_line(target_match.group(3))
        if source_display != target_display:
            return None
        pairs.append(
            (source_match.group(3), target_match.group(3), reference_labels)
        )

    return tuple(pairs)


def _nllb_inline_values_are_preserved(pairs):
    for source_part, target_part, reference_labels in pairs:
        required = protected_inline_values(
            source_part,
            include_technical=False,
            reference_labels=reference_labels,
        )
        actual = protected_inline_values(
            target_part,
            include_technical=False,
            reference_labels=reference_labels,
        )
        if not protected_sequence_is_preserved(required, actual):
            return False
    return True


def _nllb_technical_values_are_preserved(pairs):
    for source_part, target_part, reference_labels in pairs:
        required_literals = [
            item[1]
            for item in _nllb_part_contract_values(
                source_part, reference_labels
            )
            if item[0] in {"technical", "technical-contract"}
        ]
        if not _source_literals_are_preserved(
            source_part, target_part, required_literals
        ):
            return False
    return True


def _nllb_part_contract_values(
    text, reference_labels=frozenset(), ancestors=()
):
    """Return every source literal skipped by the walker in source order."""
    values = []
    cursor = 0

    def append_plain(value):
        contract = technical_contract_value(value)
        if contract is not None:
            values.append((*contract, ancestors))
        elif (
            value
            and not ancestors
            and not visible_plain_needs_translation(value)
        ):
            values.append(("verbatim-plain", value, ancestors))

    for span in inline_spans(text, reference_labels):
        append_plain(text[cursor:span.start])
        if span.kind in {"image", "link"}:
            wrapper = (span.kind, span.target)
            values.append(("wrapper", wrapper, ancestors))
            values.extend(
                _nllb_part_contract_values(
                    span.label or "", reference_labels, ancestors + (wrapper,)
                )
            )
        elif span.kind in {"reference-link", "reference-image"}:
            form = (
                "full"
                if span.label is not None
                else "collapsed"
                if span.raw.endswith("[]")
                else "shortcut"
            )
            wrapper = (span.kind, form, _normalized_reference_label(span.target or ""))
            values.append(("wrapper", wrapper, ancestors))
            if span.label is not None:
                values.extend(
                    _nllb_part_contract_values(
                        span.label, reference_labels, ancestors + (wrapper,)
                    )
                )
        elif span.kind == "emphasis":
            wrapper = ("emphasis", _emphasis_marker(span.raw))
            values.append(("wrapper", wrapper, ancestors))
            values.extend(
                _nllb_part_contract_values(
                    span.label or "", reference_labels, ancestors + (wrapper,)
                )
            )
        else:
            values.append((span.kind, span.raw, ancestors))
        cursor = span.end
    append_plain(text[cursor:])
    return tuple(values)


def _source_literals_are_preserved(source_part, target_part, literals):
    """Match source-classified literals without re-tokenizing translated prose."""
    ordered_literals = tuple(literals)
    target_cursor = 0
    for literal in ordered_literals:
        position = target_part.find(literal, target_cursor)
        if position < 0:
            return False
        target_cursor = position + len(literal)
    return all(
        target_part.count(literal) == source_part.count(literal)
        for literal in set(ordered_literals)
    )


def _nllb_all_values_are_preserved(pairs):
    source_values = []
    target_values = []
    for source_part, target_part, reference_labels in pairs:
        required = _nllb_part_contract_values(source_part, reference_labels)
        actual = _nllb_part_contract_values(target_part, reference_labels)
        ordered_literals = [
            item[1]
            for item in required
            if item[0] not in {"wrapper", "verbatim-plain"}
        ]
        source_literals = Counter(
            ordered_literals
        )
        if source_literals and not _source_literals_are_preserved(
            source_part, target_part, ordered_literals
        ):
            return False
        source_dangerous = tuple(
            item
            for item in required
            if item[0] == "inline-html"
            or (item[0] == "wrapper" and item[1][0] != "emphasis")
        )
        target_dangerous = tuple(
            item
            for item in actual
            if item[0] == "inline-html"
            or (item[0] == "wrapper" and item[1][0] != "emphasis")
        )
        if source_dangerous != target_dangerous:
            return False
        required_without_technical = tuple(
            item for item in required if item[0] != "technical"
        )
        actual_without_technical = tuple(
            item for item in actual if item[0] != "technical"
        )
        if not protected_sequence_is_preserved(
            required_without_technical, actual_without_technical
        ):
            return False
        # Whitespace-only plain fragments are context-sensitive: translated
        # prose can create a new boundary that the target-side classifier sees
        # as the same space from another line. Their per-part contract above
        # remains strict; only this cross-part collision check ignores them.
        source_values.extend(
            item for item in required_without_technical
            if not (item[0] == "verbatim-plain" and not item[1].strip())
        )
        target_values.extend(
            item for item in actual_without_technical
            if not (item[0] == "verbatim-plain" and not item[1].strip())
        )
    return protected_sequence_is_preserved(source_values, target_values)


def provider_document_contract(text):
    """Return protected values and Markdown structure for API providers."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    definitions = reference_definitions(normalized)
    reference_labels = frozenset(definition.label for definition in definitions)
    definitions_by_start = {definition.start: definition for definition in definitions}
    definition_lines = {
        line_number
        for definition in definitions
        for line_number in range(definition.start, definition.end + 1)
    }
    values = []
    structure = []
    fence = None
    fenced = []
    in_mathblock = False
    math_block = []

    for line_number, line in enumerate(normalized.splitlines(keepends=True)):
        if fence is not None:
            fenced.append(line)
            next_fence = fence_transition(line.rstrip("\n"), fence)
            if next_fence is None:
                values.append(("fenced-block", "".join(fenced)))
                structure.append(("fenced-block",))
                fenced = []
                fence = None
            continue

        bare_line = line.rstrip("\n")
        next_fence = fence_transition(bare_line)
        if next_fence is not None:
            fence = next_fence
            fenced = [line]
            continue
        if in_mathblock:
            math_block.append(line)
            if is_display_math_delimiter(bare_line):
                values.append(("display-math", "".join(math_block)))
                structure.append(("display-math",))
                math_block = []
                in_mathblock = False
            continue
        if is_display_math_delimiter(bare_line):
            in_mathblock = True
            math_block = [line]
            continue
        reference = definitions_by_start.get(line_number)
        if reference is not None:
            values.append(("reference-definition", reference.lines))
            structure.append(
                (
                    "reference-definition",
                    len(reference.lines),
                    reference.title_marker,
                )
            )
            continue
        if line_number in definition_lines:
            continue
        if bare_line.lstrip().startswith("|"):
            structure.append(
                (
                    "table-row",
                    len(split_table_row(bare_line)),
                    bool(TABLE_SEPARATOR_RE.fullmatch(bare_line)),
                )
            )
            for part in split_table_row(bare_line):
                if part != "|":
                    part_values = _nllb_part_contract_values(part, reference_labels)
                    values.extend(
                        item
                        for item in part_values
                        if item[0] not in {"technical-contract", "verbatim-plain"}
                    )
                    structure.extend(
                        (item[0], item[1])
                        for item in part_values
                        if item[0] in {"wrapper", "inline-code", "inline-math", "inline-html", "url"}
                    )
            continue
        marker = MARKER_RE.match(bare_line)
        if marker is not None and marker.group(2):
            structure.append(("block-marker", marker.group(2)))
        if THEMATIC_OR_SETEXT_RE.fullmatch(bare_line):
            structure.append(("thematic", bare_line))
        part_values = _nllb_part_contract_values(bare_line, reference_labels)
        values.extend(
            item
            for item in part_values
            if item[0] not in {"technical-contract", "verbatim-plain"}
        )
        structure.extend(
            (item[0], item[1])
            for item in part_values
            if item[0] in {"wrapper", "inline-code", "inline-math", "inline-html", "url"}
        )

    if fenced:
        values.append(("unclosed-fenced-block", "".join(fenced)))
        structure.append(("unclosed-fenced-block",))
    if math_block:
        values.append(("unclosed-display-math", "".join(math_block)))
        structure.append(("unclosed-display-math",))
    return tuple(values), tuple(structure)


def nllb_protected_content_is_preserved(src, out):
    """Check source-side structural spans on their corresponding lines.

    NLLB output may contain target-language text that resembles code or math.
    Only source spans are contractual: each must survive, in order, on the line
    whose visible prose was translated. Fenced blocks and metadata stay fully
    byte-identical because the walker never sends those lines to the model.
    """
    pairs = _nllb_aligned_visible_parts(src, out)
    return pairs is not None and _nllb_inline_values_are_preserved(pairs)


def nllb_technical_contracts_are_preserved(src, out):
    """Check source-side technical fragments in their corresponding lines.

    The NLLB walker is line preserving.  We therefore validate only fragments
    that the source classifier told the walker to keep, rather than classifying
    translated prose a second time and treating new target-language shapes as
    protected content.
    """
    pairs = _nllb_aligned_visible_parts(src, out)
    return pairs is not None and _nllb_technical_values_are_preserved(pairs)


def nllb_translation_contract_is_preserved(src, out):
    """Validate every source-side invariant of the line-preserving walker."""
    pairs = _nllb_aligned_visible_parts(src, out)
    return pairs is not None and _nllb_all_values_are_preserved(pairs)


def translation_contract_is_preserved(src, out, *, provider):
    """Apply the machine or human translation integrity policy."""
    if provider == "nllb":
        return nllb_translation_contract_is_preserved(src, out)
    if provider in {"anthropic", "openai", "deepl"}:
        source_values, source_structure = provider_document_contract(src)
        target_values, target_structure = provider_document_contract(out)
        return source_structure == target_structure and protected_sequence_is_preserved(
            source_values, target_values
        )
    return protected_content_is_preserved(src, out)


def _normalize_visible_chunks(chunks):
    """Collapse visible whitespace while retaining a line for each character."""
    normalized = []
    line_map = []
    pending_space_line = None
    for value, line_number in chunks:
        for char in value:
            if char.isspace():
                if normalized and pending_space_line is None:
                    pending_space_line = line_number
                continue
            if pending_space_line is not None:
                normalized.append(" ")
                line_map.append(pending_space_line)
                pending_space_line = None
            normalized.append(char)
            line_map.append(line_number)
    return "".join(normalized), tuple(line_map)


def _reference_heading_ordinals(text):
    """Return structural heading positions for reference-only sections."""
    ordinals = set()
    heading_ordinal = 0
    fence = None
    in_mathblock = False
    for line in text.split("\n"):
        next_fence = fence_transition(line, fence)
        if next_fence != fence or fence is not None:
            fence = next_fence
            continue
        if is_display_math_delimiter(line):
            in_mathblock = not in_mathblock
            continue
        if in_mathblock:
            continue
        match = MARKER_RE.match(line)
        if match is None or re.search(r"#{1,6}\s+", match.group(2)) is None:
            continue
        title = re.sub(r"\s+#+\s*$", "", match.group(3)).strip()
        if title.casefold() in {"further reading", "reference", "references"}:
            ordinals.add(heading_ordinal)
        heading_ordinal += 1
    return frozenset(ordinals)


def _visible_markdown_paragraph_fragments(text, reference_headings=frozenset()):
    """Return normalized visible prose fragments with source-line maps.

    Consecutive prose lines form one Markdown paragraph, so their last and
    first visible parts are joined before whitespace is normalized. Inline
    protected spans remain fragment boundaries; their code, math, URL, HTML,
    and technical-token bytes therefore never enter the untranslated scan.
    """
    visible = []
    paragraph_chunks = []
    paragraph_quote_depth = None
    paragraph_start_line = None
    paragraph_active = False
    fence = None
    in_mathblock = False
    heading_ordinal = 0
    reference_level = None
    section_stack = []
    paragraph_key = None

    def flush_paragraph():
        nonlocal paragraph_active, paragraph_key, paragraph_quote_depth, paragraph_start_line
        if not paragraph_active:
            return
        fragment, line_map = _normalize_visible_chunks(paragraph_chunks)
        visible.append((paragraph_start_line, fragment, line_map, paragraph_key))
        paragraph_chunks.clear()
        paragraph_active = False
        paragraph_key = None
        paragraph_quote_depth = None
        paragraph_start_line = None

    def append_line(line_number, body, quote_depth, reference_section, block_key):
        nonlocal paragraph_active, paragraph_key, paragraph_quote_depth, paragraph_start_line
        if not paragraph_active:
            paragraph_active = True
            paragraph_start_line = line_number
            paragraph_key = block_key
        if paragraph_chunks:
            # A Markdown soft break renders as whitespace. Joining only the
            # visible pieces also prevents protected spans from being scanned.
            paragraph_chunks.append((" ", line_number))
        parts = (
            reference_visible_parts(body)
            if reference_section
            else extract_visible_plain_parts(body)
        )
        for part in parts:
            if paragraph_chunks:
                # The omitted span is semantic, so keep its neighboring visible
                # words distinct instead of accidentally concatenating them.
                paragraph_chunks.append((" ", line_number))
            paragraph_chunks.append((part, line_number))
        paragraph_quote_depth = quote_depth

    for line_number, line in enumerate(text.split("\n"), 1):
        stripped = line.lstrip()
        next_fence = fence_transition(line, fence)
        if next_fence != fence or fence is not None:
            flush_paragraph()
            fence = next_fence
            continue
        if is_display_math_delimiter(line):
            flush_paragraph()
            in_mathblock = not in_mathblock
            continue
        if in_mathblock:
            flush_paragraph()
            continue
        if not line.strip():
            flush_paragraph()
            continue
        # Four-space/tab-indented code is verbatim just like fenced code.
        if line.startswith(("    ", "\t")):
            flush_paragraph()
            continue
        if stripped.startswith(("|", "<")) or META_RE.match(line):
            flush_paragraph()
            continue
        if THEMATIC_OR_SETEXT_RE.fullmatch(line):
            flush_paragraph()
            continue

        match = MARKER_RE.match(line)
        if match is None:
            flush_paragraph()
            continue
        markers, body = match.group(2), match.group(3)
        heading_match = re.search(r"(#{1,6})\s+", markers)
        heading = heading_match is not None
        list_item = re.search(r"(?:[-*+]|\d+\.)\s+", markers) is not None
        quote_depth = markers.count(">")
        starts_reference = heading and heading_ordinal in reference_headings
        current_heading_ordinal = heading_ordinal
        if heading:
            level = len(heading_match.group(1))
            if reference_level is not None and level <= reference_level:
                reference_level = None
            heading_ordinal += 1
        if (
            heading
            or list_item
            or (paragraph_chunks and quote_depth != paragraph_quote_depth)
        ):
            flush_paragraph()
        append_line(
            line_number,
            body,
            quote_depth,
            reference_section=reference_level is not None,
            block_key=(
                ("heading", current_heading_ordinal)
                if heading
                else (tuple(section_stack), "list" if list_item else ("quote", quote_depth) if quote_depth else "paragraph")
            ),
        )
        if heading:
            flush_paragraph()
            section_stack = [
                entry for entry in section_stack if entry[0] < level
            ]
            section_stack.append((level, current_heading_ordinal))
            if starts_reference:
                reference_level = level

    flush_paragraph()
    return tuple(visible)


def missing_visible_fragments(src, out):
    """Return substantive source prose blocks absent from the translation.

    Translation changes the words, so completeness is checked by structural
    block multiplicity rather than text equality. Short colon-ended lead-ins
    are allowed to merge into the following paragraph, as human translations
    commonly do. Headings and reference-only sections have separate structural
    checks and are deliberately excluded here.
    """
    reference_headings = _reference_heading_ordinals(src)
    source_fragments = _visible_markdown_paragraph_fragments(
        src, reference_headings
    )
    target_fragments = _visible_markdown_paragraph_fragments(
        out, reference_headings
    )

    def is_reference_key(key):
        if not isinstance(key, tuple) or len(key) != 2:
            return False
        sections = key[0]
        return isinstance(sections, tuple) and any(
            ordinal in reference_headings for _, ordinal in sections
        )

    def is_required(record):
        _, fragment, _, key = record
        if not fragment or (isinstance(key, tuple) and key[:1] == ("heading",)):
            return False
        if is_reference_key(key):
            return False
        words = ENGLISH_WORD_RE.findall(fragment)
        if fragment.rstrip().endswith(":") and len(words) <= 6:
            return False
        return len(words) >= 3 and sum(map(len, words)) >= 15

    def content_weight(fragment):
        """Approximate rendered information without assuming a target script."""
        return sum(2 if ord(char) > 127 else 1 for char in fragment if char.isalnum())

    source_groups = {}
    target_groups = {}
    for record in source_fragments:
        if is_required(record):
            source_groups.setdefault(record[3], []).append(record)
    for record in target_fragments:
        _, fragment, _, key = record
        if fragment and not (isinstance(key, tuple) and key[:1] == ("heading",)):
            target_groups.setdefault(key, []).append(record)

    missing = []
    for key, records in source_groups.items():
        targets = target_groups.get(key, [])
        deficit = len(records) - len(targets)
        if deficit > 0:
            missing.extend(
                (line, fragment) for line, fragment, _, _ in records[-deficit:]
            )
            continue


    # Equal per-section block counts alone do not prove completeness: a few
    # short filler paragraphs can replace a full lesson. Compare aggregate
    # visible information across all required blocks. Non-ASCII text receives
    # two units per character to account conservatively for denser scripts. The
    # 50% floor sits below every complete reviewed zh lesson while still
    # catching the short filler that otherwise balances a missing paragraph.
    required_records = [record for records in source_groups.values() for record in records]
    relevant_target_keys = set(source_groups)
    target_records = [
        record
        for key, records in target_groups.items()
        if key in relevant_target_keys
        for record in records
    ]
    source_weight = sum(content_weight(record[1]) for record in required_records)
    target_weight = sum(content_weight(record[1]) for record in target_records)
    if (
        not missing
        and len(required_records) > 1
        and source_weight
        and target_weight * 2 < source_weight
    ):
        already_missing = {line for line, _ in missing}
        missing.extend(
            (line, fragment)
            for line, fragment, _, _ in required_records
            if line not in already_missing
        )
    return tuple(missing)


def untranslated_fragments(src, out, min_words=3, min_letters=15):
    """Find substantive source prose copied verbatim into a zh translation.

    Visible Markdown paragraphs are compared after non-semantic whitespace is
    collapsed, so provider reflow and soft line breaks cannot hide untranslated
    prose. Fenced/indented code, math, raw HTML, metadata, inline code, and URLs
    stay outside the comparison. Each result retains the source line and maps
    the normalized match back to its actual target line when possible.
    """
    reference_headings = _reference_heading_ordinals(src)
    source_fragments = _visible_markdown_paragraph_fragments(
        src, reference_headings
    )
    target_fragments = _visible_markdown_paragraph_fragments(
        out, reference_headings
    )
    source_groups = {}
    target_groups = {}
    for record in source_fragments:
        source_groups.setdefault(record[3], []).append(record)
    for record in target_fragments:
        target_groups.setdefault(record[3], []).append(record)

    findings = []
    for key, source_group in source_groups.items():
        target_group = target_groups.get(key, [])
        same_size = len(source_group) == len(target_group)
        used_targets = set()
        for index, (source_line, fragment, _, _) in enumerate(source_group):
            words = ENGLISH_WORD_RE.findall(fragment)
            if len(words) < min_words or sum(map(len, words)) < min_letters:
                continue
            if is_technical_fragment(fragment):
                continue
            candidates = (
                ((index, target_group[index]),) if same_size and index < len(target_group)
                else tuple(enumerate(target_group))
            )
            for target_index, (target_start, target_fragment, target_line_map, _) in candidates:
                if target_index in used_targets:
                    continue
                offset = target_fragment.find(fragment)
                if offset < 0:
                    continue
                target_line = target_line_map[offset] if target_line_map else target_start
                findings.append((source_line, target_line, fragment))
                used_targets.add(target_index)
                break
    return tuple(findings)


def untranslated_table_cells(src, out, min_words=3, min_letters=15):
    """Find visible English table cells copied verbatim into a translation."""
    def table_blocks(text):
        blocks = []
        rows = []
        fence = None
        in_mathblock = False

        def flush():
            if rows:
                blocks.append(tuple(rows))
                rows.clear()

        for line_number, line in enumerate(text.split("\n"), 1):
            next_fence = fence_transition(line, fence)
            if next_fence != fence or fence is not None:
                flush()
                fence = next_fence
                continue
            if is_display_math_delimiter(line):
                flush()
                in_mathblock = not in_mathblock
                continue
            if in_mathblock:
                flush()
                continue
            if not line.strip():
                # Do not orphan later rows when a translation accidentally
                # inserts a blank line inside an otherwise continuous table.
                continue
            if not line.lstrip().startswith("|"):
                flush()
                continue
            separator = TABLE_SEPARATOR_RE.fullmatch(line) is not None
            if separator:
                continue
            cells = [part.strip() for part in split_table_row(line) if part != "|"]
            if cells and not cells[0]:
                cells.pop(0)
            if cells and not cells[-1]:
                cells.pop()
            rows.append((line_number, cells))
        flush()
        return tuple(blocks)

    findings = []
    source_blocks = table_blocks(src)
    target_blocks = table_blocks(out)
    for block_index, source_rows in enumerate(source_blocks):
        if block_index >= len(target_blocks):
            continue
        target_rows = target_blocks[block_index]
        same_size = len(source_rows) == len(target_rows)
        used_targets = set()
        for row_index, (_, source_cells) in enumerate(source_rows):
            for column, source_cell in enumerate(source_cells, 1):
                visible = " ".join(extract_visible_plain_parts(source_cell)).strip()
                words = ENGLISH_WORD_RE.findall(visible)
                if (
                    len(words) < min_words
                    or sum(map(len, words)) < min_letters
                    or is_technical_fragment(visible)
                ):
                    continue
                candidates = (
                    ((row_index, target_rows[row_index]),)
                    if same_size and row_index < len(target_rows)
                    else tuple(enumerate(target_rows))
                )
                for target_index, (target_line, target_cells) in candidates:
                    target_key = (target_index, column)
                    if target_key in used_targets:
                        continue
                    if column <= len(target_cells) and target_cells[column - 1] == source_cell:
                        findings.append((target_line, column, visible))
                        used_targets.add(target_key)
                        break
    return tuple(findings)


def suspicious_repetitions(text, min_characters=6):
    """Return obvious repeated-Han generation loops outside code/math."""
    findings = []
    fence = None
    in_mathblock = False
    for line_number, line in enumerate(text.split("\n"), 1):
        next_fence = fence_transition(line, fence)
        if next_fence != fence or fence is not None:
            fence = next_fence
            continue
        if is_display_math_line(line):
            if is_display_math_delimiter(line):
                in_mathblock = not in_mathblock
            continue
        if in_mathblock:
            continue
        visible = " ".join(extract_visible_plain_parts(line))
        for match in REPEATED_HAN_RE.finditer(visible):
            if len(match.group(0)) >= min_characters:
                findings.append((line_number, match.group(0)))
    return tuple(findings)


def translation_integrity_issues(src, out, lang, provider):
    """Return reasons a translation must be regenerated or rejected."""
    issues = []
    if not out.strip():
        issues.append("translation is empty")
    if has_protection_sentinel_residue(out):
        issues.append("translation contains an unresolved protection sentinel")
    if provider != "echo" and out == src:
        issues.append("translation is identical to the English source")
    if lang == "zh" and provider != "echo" and not HAN_RE.search(out):
        issues.append("Simplified Chinese translation contains no Han characters")
    if provider == "nllb" and not translation_contract_is_preserved(
        src, out, provider=provider
    ):
        issues.append("NLLB changed content that must remain byte-identical")
    elif provider != "echo" and not translation_contract_is_preserved(
        src, out, provider=provider
    ):
        issues.append("protected technical content differs from the source")
    if provider != "echo":
        language_name = LANG_NAMES.get(lang, lang)
        missing = missing_visible_fragments(src, out)
        if missing:
            preview = "; ".join(
                f"source line {line_number}: {fragment!r}"
                for line_number, fragment in missing[:3]
            )
            issues.append(
                f"{language_name} translation omits "
                f"{len(missing)} substantive visible block(s): {preview}"
            )
        untranslated = untranslated_fragments(src, out)
        if untranslated:
            preview = "; ".join(
                f"source line {source_line}: {fragment!r}"
                for source_line, _, fragment in untranslated[:3]
            )
            issues.append(
                f"{language_name} translation retains "
                f"{len(untranslated)} substantive English fragment(s): {preview}"
            )
        untranslated_cells = untranslated_table_cells(src, out)
        if untranslated_cells:
            preview = "; ".join(
                f"line {line_number}, column {column}: {fragment!r}"
                for line_number, column, fragment in untranslated_cells[:3]
            )
            issues.append(
                f"{language_name} translation retains "
                f"{len(untranslated_cells)} substantive English table cell(s): {preview}"
            )
        repeated = suspicious_repetitions(out) if lang == "zh" else ()
        if repeated:
            preview = "; ".join(
                f"line {line_number}: {fragment[:40]!r}"
                for line_number, fragment in repeated[:3]
            )
            issues.append(
                f"Simplified Chinese translation contains "
                f"{len(repeated)} suspicious repeated text run(s): {preview}"
            )
    return issues


def translation_cache_is_valid(src, out, lang, provider):
    """Return whether a cached translation can be reused safely."""
    return not translation_integrity_issues(src, out, lang, provider)


def source_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()


def translation_cache_entry(value):
    """Return ``(source_sha256, provider)`` from legacy or current cache data."""
    if isinstance(value, str):
        return value, "nllb"
    if isinstance(value, dict):
        return value.get("source_sha256"), value.get("provider")
    return value, None


def cache_entry_matches(value, source_digest, provider, output_digest):
    """Require provenance for the exact source, output, model, and pipeline."""
    if not isinstance(value, dict):
        return False
    return (
        value.get("source_sha256") == source_digest
        and value.get("output_sha256") == output_digest
        and value.get("provider") == provider
        and value.get("model") == translation_model(provider)
        and value.get("pipeline_version") == TRANSLATION_PIPELINE_VERSION
    )


def lesson_docs():
    # Same "what is a lesson" definition as the catalog/book/llms.txt tooling,
    # so a non-conforming dir can't become a translated, published lesson.
    for phase in sorted(PHASES.iterdir()):
        if not PHASE_DIR_RE.fullmatch(phase.name):
            continue
        if phase.is_symlink():
            raise ValueError(f"source lesson path contains a symlink: {phase}")
        if not phase.is_dir():
            continue
        for lesson in sorted(phase.iterdir()):
            if not LESSON_DIR_RE.fullmatch(lesson.name):
                continue
            if lesson.is_symlink():
                raise ValueError(
                    f"source lesson path contains a symlink: {lesson}"
                )
            if not lesson.is_dir():
                continue
            docs = lesson / "docs"
            doc = lesson / "docs" / "en.md"
            for component in (docs, doc):
                if component.is_symlink():
                    raise ValueError(
                        f"source lesson path contains a symlink: {component}"
                    )
            if doc.is_file():
                yield doc


def targets():
    # Lessons only. The per-language README is hand-authored and built by
    # scripts/build_readme_i18n.py into i18n/<lang>/README.md; translating it
    # here would overwrite that file with a machine translation, so the README
    # is deliberately not a target of this script.
    yield from lesson_docs()


def out_path(doc, lang):
    rel = doc.relative_to(ROOT).parent / f"{lang}.md"
    return _safe_language_path(lang, *rel.parts)


def remove_orphan_phase_outputs(lang, phase, expected_paths, *, dry_run=False):
    """Remove translated lesson files that have no source in *phase*."""
    phase_root = _safe_language_path(lang, "phases", phase)
    if not phase_root.is_dir():
        return 0

    removed = 0
    for candidate in sorted(phase_root.glob(f"*/docs/{lang}.md")):
        cursor = phase_root
        for part in candidate.relative_to(phase_root).parts:
            cursor /= part
            if cursor.is_symlink():
                raise ValueError(
                    f"translation path for {lang!r} contains a symlink: {cursor}"
                )
        resolved = candidate.resolve()
        if not resolved.is_relative_to(phase_root):
            raise ValueError(
                f"translation path for {lang!r} resolves outside phase slice"
            )
        if resolved in expected_paths:
            continue
        action = "would remove" if dry_run else "removed"
        print(
            f"{action} orphan translation -> "
            f"{candidate.relative_to(ROOT.resolve())}"
        )
        removed += 1
        if dry_run:
            continue
        candidate.unlink()
        parent = candidate.parent
        while parent != phase_root:
            try:
                parent.rmdir()
            except OSError:
                break
            parent = parent.parent
    return removed


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
    if raw is None:
        return None
    if not placeholder_sequence_is_valid(protected, raw):
        return None  # placeholder mismatch -> caller keeps English
    return restore(raw, store)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True)
    ap.add_argument("--provider", default=os.environ.get("TRANSLATE_PROVIDER", "nllb"))
    ap.add_argument("--phase", help="limit to one phase dir name")
    ap.add_argument("--only", help="limit to one lesson path (phases/.../lesson)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.provider not in TRANSLATION_PROVIDERS and args.provider != "echo":
        ap.error(
            f"unknown provider {args.provider!r}; choose one of "
            + ", ".join(sorted(TRANSLATION_PROVIDERS))
        )
    try:
        args.lang = validate_language(args.lang)
        args.phase = validate_phase(ROOT, args.phase)
    except ValueError as exc:
        ap.error(str(exc))
    with translation_lock(args.lang):
        return run_translation(args)


def run_translation(args):
    """Run one translation job while the caller holds its language lock."""
    cpath = cache_path(args.lang, args.phase)
    cache = {}
    if cpath.is_file():
        cache = json.loads(cpath.read_text(encoding="utf-8"))

    def save_cache():
        write_json_atomically(cpath, cache)

    documents = list(targets())
    if args.phase and not args.only:
        phase_prefix = f"phases/{args.phase}/"
        phase_documents = {
            str(doc.relative_to(ROOT)): doc
            for doc in documents
            if str(doc.relative_to(ROOT)).startswith(phase_prefix)
        }
        expected_outputs = {
            out_path(doc, args.lang) for doc in phase_documents.values()
        }
        remove_orphan_phase_outputs(
            args.lang, args.phase, expected_outputs, dry_run=args.dry_run
        )
        orphan_cache_keys = sorted(set(cache) - set(phase_documents))
        if orphan_cache_keys:
            action = "would remove" if args.dry_run else "removed"
            for key in orphan_cache_keys:
                print(f"{action} orphan cache key -> {key}")
            if not args.dry_run:
                for key in orphan_cache_keys:
                    cache.pop(key)
                save_cache()

    translated = skipped = 0
    for doc in documents:
        rel = str(doc.relative_to(ROOT))
        if args.phase and f"/{args.phase}/" not in f"/{rel}":
            continue
        if args.only and not (rel == args.only.strip("/") or rel.startswith(args.only.strip("/") + "/")):
            continue

        src = doc.read_text(encoding="utf-8")
        h = source_hash(src)
        dst = out_path(doc, args.lang)
        # key is the lesson path; the cache file is already per-language
        existing_bytes = dst.read_bytes() if dst.is_file() else None
        existing_digest = (
            hashlib.sha256(existing_bytes).hexdigest()
            if existing_bytes is not None
            else None
        )
        if cache_entry_matches(
            cache.get(rel), h, args.provider, existing_digest
        ):
            existing = existing_bytes.decode("utf-8")
            existing_issues = translation_integrity_issues(src, existing, args.lang, args.provider)
            if not existing_issues:
                skipped += 1
                continue
            print(
                f"WARNING invalid cached translation in {rel}: "
                + "; ".join(existing_issues)
                + "; regenerating",
                file=sys.stderr,
            )

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
            write_text_atomically(dst, src)
            cache.pop(rel, None)
            save_cache()
            continue
        integrity_issues = translation_integrity_issues(
            src, out, args.lang, args.provider
        )
        if integrity_issues:
            raise RuntimeError(
                f"invalid translation for {rel}: " + "; ".join(integrity_issues)
            )
        write_text_atomically(dst, out)
        if args.provider != "echo":
            cache[rel] = {
                "source_sha256": h,
                "output_sha256": hashlib.sha256(dst.read_bytes()).hexdigest(),
                "provider": args.provider,
                "model": translation_model(args.provider),
                "pipeline_version": TRANSLATION_PIPELINE_VERSION,
            }
        else:
            cache.pop(rel, None)
        translated += 1
        # persist after every lesson so a killed run resumes here, never restarts
        save_cache()
        print(f"translated {rel} -> {args.lang}")

    if not args.dry_run:
        save_cache()
    print(f"{args.lang}: {translated} translated, {skipped} unchanged (cache hit)")


if __name__ == "__main__":
    main()
