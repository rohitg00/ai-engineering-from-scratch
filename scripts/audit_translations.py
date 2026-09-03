#!/usr/bin/env python3
"""Audit lesson translations against the canonical English documents.

By default translations are read directly from ``origin/translations``; no
checkout or worktree is required.  A local tree can be audited instead:

    python3 scripts/audit_translations.py --lang zh
    python3 scripts/audit_translations.py --lang zh --translation-ref origin/translations
    python3 scripts/audit_translations.py --lang zh --translation-root /tmp/export

The local root is the directory that contains ``i18n/``.  Exit status is zero
only when path coverage, cache provenance, content, and Markdown structure are
all valid.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Protocol, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_catalog import LESSON_DIR_RE, PHASE_DIR_RE  # noqa: E402
from translate_lessons import (  # noqa: E402
    LANGUAGE_REGISTRY,
    TRANSLATION_PIPELINE_VERSION,
    TRANSLATION_PROVIDERS,
    has_protection_sentinel_residue,
    missing_visible_fragments,
    suspicious_repetitions,
    translation_cache_entry,
    translation_contract_is_preserved,
    split_table_row,
    untranslated_fragments,
    untranslated_table_cells,
    validate_language,
    validate_phase,
)


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TRANSLATION_REF = "origin/translations"
MANUAL_TRANSLATION_PROVIDER = "manual"

ATX_HEADING_RE = re.compile(r"^ {0,3}(#{1,6})(?:[ \t]+|$)")
FENCE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
# The translator's sentinel is U+2063 + PROTECT<number> + U+2063.  Match the
# bare core too, so a provider that drops either invisible separator cannot
# leave an apparently clean translation behind.
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
METADATA_RE = re.compile(
    r"^\s*\*\*(Type|Language|Languages|Prerequisites|Phases exercised|Time|Related):\*\*"
)

HAN_RANGES = (
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xF900, 0xFAFF),
    (0x20000, 0x2A6DF),
    (0x2A700, 0x2B73F),
    (0x2B740, 0x2B81F),
    (0x2B820, 0x2CEAF),
    (0x2CEB0, 0x2EBEF),
    (0x2F800, 0x2FA1F),
    (0x30000, 0x3134F),
)


class TranslationSourceError(RuntimeError):
    """The selected translation tree could not be listed or read."""


class TranslationSource(Protocol):
    @property
    def label(self) -> str:
        """Human-readable source label used in reports."""
        ...

    def list_files(self, prefix: str) -> set[str]:
        """Return POSIX paths for every file below *prefix*."""
        ...

    def read_bytes(self, path: str) -> bytes:
        """Read one path from the selected tree."""
        ...


@dataclass(frozen=True)
class LocalTranslationSource:
    root: Path

    @property
    def label(self) -> str:
        return f"local root {self.root}"

    def list_files(self, prefix: str) -> set[str]:
        base = self._contained_path(prefix)
        root = self.root.resolve()
        if not base.exists():
            return set()
        if not base.is_dir():
            raise TranslationSourceError(f"translation path is not a directory: {base}")
        try:
            return {
                path.relative_to(root).as_posix()
                for path in base.rglob("*")
                if path.is_file()
            }
        except OSError as exc:
            raise TranslationSourceError(f"cannot list {base}: {exc}") from exc

    def read_bytes(self, path: str) -> bytes:
        target = self._contained_path(path)
        try:
            return target.read_bytes()
        except OSError as exc:
            raise TranslationSourceError(f"cannot read {target}: {exc}") from exc

    def _contained_path(self, path: str) -> Path:
        relative = PurePosixPath(path)
        if relative.is_absolute() or ".." in relative.parts:
            raise TranslationSourceError(f"translation path escapes local root: {path!r}")
        root = self.root.resolve()
        target = root.joinpath(*relative.parts).resolve()
        if target != root and not target.is_relative_to(root):
            raise TranslationSourceError(f"translation path escapes local root: {path!r}")
        return target


@dataclass(frozen=True)
class GitTranslationSource:
    repo_root: Path
    ref: str = DEFAULT_TRANSLATION_REF

    @property
    def label(self) -> str:
        return f"git ref {self.ref}"

    def _git(self, *args: str) -> bytes:
        try:
            result = subprocess.run(
                ["git", "-C", str(self.repo_root), *args],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
        except OSError as exc:
            raise TranslationSourceError(f"cannot run git: {exc}") from exc
        if result.returncode != 0:
            detail = result.stderr.decode("utf-8", errors="replace").strip()
            command = "git " + " ".join(args[:2])
            raise TranslationSourceError(
                f"{command} failed for {self.ref!r}: {detail or 'unknown git error'}"
            )
        return result.stdout

    def list_files(self, prefix: str) -> set[str]:
        raw = self._git("ls-tree", "-r", "-z", "--name-only", self.ref, "--", prefix)
        try:
            return {item.decode("utf-8") for item in raw.split(b"\0") if item}
        except UnicodeDecodeError as exc:
            raise TranslationSourceError(
                f"git ref {self.ref!r} contains a non-UTF-8 path below {prefix}"
            ) from exc

    def read_bytes(self, path: str) -> bytes:
        return self._git("show", f"{self.ref}:{path}")


@dataclass(frozen=True)
class MarkdownStructure:
    heading_levels: tuple[int, ...]
    fence_lines: tuple[str, ...]
    table_line_count: int
    table_column_counts: tuple[int, ...]
    raw_html_line_count: int


@dataclass(frozen=True)
class Issue:
    rule: str
    path: str
    message: str


@dataclass
class AuditResult:
    lang: str
    source_label: str
    canonical_count: int = 0
    expected_translation_count: int = 0
    found_translation_count: int = 0
    checked_translation_count: int = 0
    cache_file_count: int = 0
    expected_cache_key_count: int = 0
    found_cache_key_count: int = 0
    issues: list[Issue] = field(default_factory=list)

    def add(self, rule: str, path: str, message: str) -> None:
        self.issues.append(Issue(rule, path, message))


def contains_han(text: str) -> bool:
    return any(start <= ord(char) <= end for char in text for start, end in HAN_RANGES)


def markdown_structure(text: str) -> MarkdownStructure:
    """Extract translation-invariant Markdown structure.

    Headings, table rows, and raw HTML inside fenced code do not count.  Fence
    delimiter lines are retained exactly (apart from newline characters), so a
    changed language tag, delimiter kind, or delimiter count is detected.
    """

    headings: list[int] = []
    fences: list[str] = []
    table_lines = 0
    table_columns: list[int] = []
    html_lines = 0
    fence_char: str | None = None
    fence_length = 0

    for line in text.splitlines():
        fence_match = FENCE_RE.match(line)
        if fence_char is None:
            if fence_match:
                marker = fence_match.group(1)
                fences.append(line)
                fence_char = marker[0]
                fence_length = len(marker)
                continue
        else:
            if fence_match:
                marker = fence_match.group(1)
                suffix = fence_match.group(2)
                if (
                    marker[0] == fence_char
                    and len(marker) >= fence_length
                    and not suffix.strip()
                ):
                    fences.append(line)
                    fence_char = None
                    fence_length = 0
            continue

        heading_match = ATX_HEADING_RE.match(line)
        if heading_match:
            headings.append(len(heading_match.group(1)))
        stripped = line.lstrip()
        if stripped.startswith("|"):
            table_lines += 1
            parts = split_table_row(line)
            cells = [part for part in parts if part != "|"]
            if cells and not cells[0].strip():
                cells.pop(0)
            if cells and not cells[-1].strip():
                cells.pop()
            table_columns.append(len(cells))
        if stripped.startswith("<"):
            html_lines += 1

    return MarkdownStructure(
        tuple(headings), tuple(fences), table_lines, tuple(table_columns), html_lines
    )


def canonical_documents(repo_root: Path, phase: str | None = None) -> dict[str, Path]:
    validate_phase(repo_root, phase)
    pattern = f"phases/{phase}/*/docs/en.md" if phase else "phases/*/*/docs/en.md"
    paths = sorted(
        path
        for path in repo_root.glob(pattern)
        if path.is_file()
        and PHASE_DIR_RE.fullmatch(path.parts[-4])
        and LESSON_DIR_RE.fullmatch(path.parts[-3])
    )
    return {path.relative_to(repo_root).as_posix(): path for path in paths}


def translated_path(source_path: str, lang: str) -> str:
    validate_language(lang, allow_manual=True)
    source = PurePosixPath(source_path)
    return (PurePosixPath("i18n") / lang / source.parent / f"{lang}.md").as_posix()


def _decode_utf8(raw: bytes, result: AuditResult, rule: str, path: str) -> str | None:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        result.add(rule, path, f"not valid UTF-8: {exc}")
        return None


def _read_source_file(
    source: TranslationSource, result: AuditResult, path: str, rule: str
) -> bytes | None:
    try:
        return source.read_bytes(path)
    except TranslationSourceError as exc:
        result.add(rule, path, str(exc))
        return None


def _load_cache_file(
    source: TranslationSource, result: AuditResult, path: str
) -> dict[str, object]:
    raw = _read_source_file(source, result, path, "cache-read")
    if raw is None:
        return {}
    text = _decode_utf8(raw, result, "cache-utf8", path)
    if text is None:
        return {}

    duplicate_keys: list[str] = []

    def reject_duplicate_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
        parsed: dict[str, object] = {}
        for key, value in pairs:
            if key in parsed:
                duplicate_keys.append(key)
            parsed[key] = value
        return parsed

    try:
        payload = json.loads(text, object_pairs_hook=reject_duplicate_keys)
    except json.JSONDecodeError as exc:
        result.add("cache-json", path, f"invalid JSON: {exc}")
        return {}
    for key in sorted(set(duplicate_keys)):
        result.add("cache-duplicate", path, f"duplicate JSON key {key!r}")
    if not isinstance(payload, dict):
        result.add("cache-shape", path, "cache must be a JSON object")
        return {}
    return payload


def _compare_structure(
    result: AuditResult, path: str, english: str, translation: str
) -> None:
    source = markdown_structure(english)
    target = markdown_structure(translation)
    if source.heading_levels != target.heading_levels:
        result.add(
            "structure-headings",
            path,
            "heading levels differ: "
            f"source={list(source.heading_levels)}, translation={list(target.heading_levels)}",
        )
    if source.fence_lines != target.fence_lines:
        result.add(
            "structure-fences",
            path,
            "fence delimiter lines differ: "
            f"source={list(source.fence_lines)!r}, translation={list(target.fence_lines)!r}",
        )
    if source.table_line_count != target.table_line_count:
        result.add(
            "structure-tables",
            path,
            "table line count differs: "
            f"source={source.table_line_count}, translation={target.table_line_count}",
        )
    if source.table_column_counts != target.table_column_counts:
        result.add(
            "structure-table-columns",
            path,
            "table column counts differ: "
            f"source={list(source.table_column_counts)}, "
            f"translation={list(target.table_column_counts)}",
        )
    if source.raw_html_line_count != target.raw_html_line_count:
        result.add(
            "structure-html",
            path,
            "raw HTML line count differs: "
            f"source={source.raw_html_line_count}, translation={target.raw_html_line_count}",
        )
    source_metadata = tuple(
        match.group(1)
        for line in english.splitlines()
        if (match := METADATA_RE.match(line))
    )
    target_metadata = tuple(
        match.group(1)
        for line in translation.splitlines()
        if (match := METADATA_RE.match(line))
    )
    if source_metadata != target_metadata:
        result.add(
            "structure-metadata",
            path,
            "metadata keys differ: "
            f"source={list(source_metadata)}, translation={list(target_metadata)}",
        )


def audit_translations(
    repo_root: Path,
    lang: str,
    source: TranslationSource,
    phase: str | None = None,
) -> AuditResult:
    repo_root = repo_root.resolve()
    validate_language(lang, allow_manual=True)
    validate_phase(repo_root, phase)
    result = AuditResult(lang=lang, source_label=source.label)
    documents = canonical_documents(repo_root, phase)
    expected_keys = set(documents)
    expected_paths = {translated_path(path, lang): path for path in expected_keys}
    result.canonical_count = len(documents)
    result.expected_translation_count = len(expected_paths)
    result.expected_cache_key_count = len(expected_keys)

    if not documents:
        result.add(
            "canonical-empty",
            "phases/*/*/docs/en.md",
            "no canonical lesson documents found",
        )

    language_root = f"i18n/{lang}"
    all_files = source.list_files(language_root)
    phase_prefix = (
        f"{language_root}/phases/{phase}/"
        if phase
        else f"{language_root}/phases/"
    )
    actual_paths = {path for path in all_files if path.startswith(phase_prefix)}
    result.found_translation_count = len(actual_paths)

    for path in sorted(set(expected_paths) - actual_paths):
        result.add(
            "translation-missing",
            path,
            f"missing translation for {expected_paths[path]}",
        )
    for path in sorted(actual_paths - set(expected_paths)):
        result.add(
            "translation-extra",
            path,
            "translation path has no canonical phases/*/*/docs/en.md source",
        )

    combined_cache = f"{language_root}/.translate-cache.json"
    cache_prefix = f"{language_root}/.cache/"
    cache_area_files = {
        path
        for path in all_files
        if path.startswith(cache_prefix)
        and (phase is None or path == f"{cache_prefix}{phase}.json")
    }
    phase_cache_files = sorted(
        path
        for path in all_files
        if path.startswith(cache_prefix)
        and path.endswith(".json")
        and (phase is None or path == f"{cache_prefix}{phase}.json")
    )
    if combined_cache in all_files and phase_cache_files:
        result.add(
            "cache-layout-conflict",
            language_root,
            "combined and per-phase cache layouts must not coexist",
        )
    # Prefer the sharded cache whenever it exists. A full local translation may
    # use the legacy combined cache; when auditing one phase, entries belonging
    # to other phases are deliberately ignored instead of reported as extras.
    if phase_cache_files:
        cache_files = phase_cache_files
    elif combined_cache in all_files:
        cache_files = [combined_cache]
    else:
        cache_files = []
    result.cache_file_count = len(cache_files)
    for path in sorted(cache_area_files - set(cache_files)):
        result.add("cache-file", path, "unexpected non-JSON file in translation cache")
    if not cache_files:
        result.add(
            "cache-missing",
            language_root,
            "no .translate-cache.json or .cache/*.json files found",
        )

    cache: dict[str, object] = {}
    cache_origins: dict[str, str] = {}
    for cache_path in cache_files:
        entries = _load_cache_file(source, result, cache_path)
        shard_phase = None
        if cache_path.startswith(cache_prefix):
            shard_phase = PurePosixPath(cache_path).stem
            if PHASE_DIR_RE.fullmatch(shard_phase) is None:
                result.add(
                    "cache-shard", cache_path, "cache filename is not a phase name"
                )
        for key, value in entries.items():
            if not isinstance(key, str):
                # JSON object keys are strings by definition; retained as a
                # defensive guard for alternate parsers or direct callers.
                result.add("cache-key", cache_path, f"non-string cache key {key!r}")
                continue
            if key in cache_origins:
                result.add(
                    "cache-duplicate",
                    cache_path,
                    f"cache key {key!r} also appears in {cache_origins[key]}",
                )
                continue
            if shard_phase is not None and not key.startswith(
                f"phases/{shard_phase}/"
            ):
                result.add(
                    "cache-shard-key",
                    cache_path,
                    f"cache key {key!r} does not belong to phase {shard_phase!r}",
                )
                continue
            if phase is not None and key not in expected_keys:
                continue
            cache[key] = value
            cache_origins[key] = cache_path

    result.found_cache_key_count = len(cache)
    for key in sorted(expected_keys - set(cache)):
        result.add("cache-key-missing", key, "canonical source is absent from cache")
    for key in sorted(set(cache) - expected_keys):
        result.add("cache-key-extra", key, "cache key has no canonical source")

    english_bytes: dict[str, bytes] = {}
    english_text: dict[str, str] = {}
    manual_language = bool(LANGUAGE_REGISTRY.get(lang, {}).get("manual"))
    for source_path, disk_path in documents.items():
        try:
            raw = disk_path.read_bytes()
        except OSError as exc:
            result.add("canonical-read", source_path, f"cannot read canonical source: {exc}")
            continue
        english_bytes[source_path] = raw
        text = _decode_utf8(raw, result, "canonical-utf8", source_path)
        if text is not None:
            english_text[source_path] = text

        if source_path not in cache:
            continue
        cached_hash, cached_provider = translation_cache_entry(cache[source_path])
        cache_value = cache[source_path]
        # Match translate_lessons.py exactly: Path.read_text() performs
        # universal-newline conversion before source_hash() encodes the text.
        # This matters for a locally audited checkout containing CRLF files.
        source_for_hash = english_text.get(source_path)
        if source_for_hash is None:
            continue
        source_for_hash = source_for_hash.replace("\r\n", "\n").replace("\r", "\n")
        expected_hash = hashlib.sha256(source_for_hash.encode("utf-8")).hexdigest()
        if not isinstance(cached_hash, str) or not SHA256_RE.fullmatch(cached_hash):
            result.add(
                "cache-hash",
                cache_origins[source_path],
                f"{source_path} has invalid SHA-256 value {cached_hash!r}",
            )
        elif cached_hash != expected_hash:
            result.add(
                "cache-hash",
                cache_origins[source_path],
                f"{source_path} is stale: expected {expected_hash}, got {cached_hash}",
            )
        if manual_language:
            required_provenance = {
                "source_sha256",
                "output_sha256",
                "provider",
            }
        else:
            required_provenance = {
                "source_sha256",
                "output_sha256",
                "provider",
                "model",
                "pipeline_version",
            }

        if not isinstance(cache_value, dict):
            result.add(
                "cache-provenance",
                cache_origins[source_path],
                f"{source_path} uses a legacy cache record; "
                "structured source/output provenance is required",
            )
        else:
            missing_fields = sorted(required_provenance - set(cache_value))
            if missing_fields:
                result.add(
                    "cache-provenance",
                    cache_origins[source_path],
                    f"{source_path} is missing provenance fields {missing_fields}",
                )
            output_hash = cache_value.get("output_sha256")
            if "output_sha256" in cache_value and (
                not isinstance(output_hash, str)
                or not SHA256_RE.fullmatch(output_hash)
            ):
                result.add(
                    "cache-output-hash",
                    cache_origins[source_path],
                    f"{source_path} has invalid output SHA-256 value "
                    f"{output_hash!r}",
                )

        if manual_language:
            if cached_provider != MANUAL_TRANSLATION_PROVIDER:
                result.add(
                    "cache-provider",
                    cache_origins[source_path],
                    f"{source_path} has invalid manual translation provider "
                    f"{cached_provider!r}; expected "
                    f"{MANUAL_TRANSLATION_PROVIDER!r}",
                )
        else:
            if (
                not isinstance(cached_provider, str)
                or cached_provider not in TRANSLATION_PROVIDERS
            ):
                result.add(
                    "cache-provider",
                    cache_origins[source_path],
                    f"{source_path} has invalid translation provider "
                    f"{cached_provider!r}",
                )
            if isinstance(cache_value, dict):
                model = cache_value.get("model")
                if "model" in cache_value and (
                    not isinstance(model, str) or not model.strip()
                ):
                    result.add(
                        "cache-model",
                        cache_origins[source_path],
                        f"{source_path} has invalid model {model!r}",
                    )
                pipeline_version = cache_value.get("pipeline_version")
                if (
                    "pipeline_version" in cache_value
                    and pipeline_version != TRANSLATION_PIPELINE_VERSION
                ):
                    result.add(
                        "cache-pipeline",
                        cache_origins[source_path],
                        f"{source_path} was produced by stale pipeline "
                        f"{pipeline_version!r}",
                    )

    for target_path in sorted(set(expected_paths) & actual_paths):
        source_path = expected_paths[target_path]
        raw = _read_source_file(source, result, target_path, "translation-read")
        if raw is None:
            continue
        result.checked_translation_count += 1
        text = _decode_utf8(raw, result, "translation-utf8", target_path)
        if text is None:
            continue
        if not text.strip():
            result.add("translation-empty", target_path, "translation is empty")
            continue
        if has_protection_sentinel_residue(text):
            result.add(
                "translation-sentinel",
                target_path,
                "translation contains an unresolved PROTECT sentinel",
            )
        source_raw = english_bytes.get(source_path)
        if source_raw is not None and raw == source_raw:
            result.add(
                "translation-identical",
                target_path,
                "translation is byte-identical to its English source",
            )
        cache_value = cache.get(source_path)
        cached_output_hash = (
            cache_value.get("output_sha256")
            if isinstance(cache_value, dict)
            else None
        )
        if isinstance(cached_output_hash, str) and SHA256_RE.fullmatch(
            cached_output_hash
        ):
            actual_output_hash = hashlib.sha256(raw).hexdigest()
            if cached_output_hash != actual_output_hash:
                result.add(
                    "cache-output-hash",
                    cache_origins[source_path],
                    f"{source_path} output is stale: expected "
                    f"{cached_output_hash}, got {actual_output_hash}",
                )
        if lang == "zh" and not contains_han(text):
            result.add(
                "translation-no-han",
                target_path,
                "Simplified Chinese translation contains no Han characters",
            )
        source_text = english_text.get(source_path)
        if source_text is not None:
            _compare_structure(result, target_path, source_text, text)
            _, cached_provider = translation_cache_entry(cache.get(source_path))
            integrity_provider = (
                "manual"
                if manual_language
                else cached_provider
                if cached_provider in TRANSLATION_PROVIDERS
                else "nllb"
            )
            protected_ok = translation_contract_is_preserved(
                source_text, text, provider=integrity_provider
            )
            if not protected_ok:
                result.add(
                    "structure-protected-content",
                    target_path,
                    "protected technical content differs from the source",
                )
            for source_line, fragment in missing_visible_fragments(
                source_text, text
            ):
                result.add(
                    "translation-missing-prose",
                    target_path,
                    f"translation omits substantive source line "
                    f"{source_line}: {fragment!r}",
                )
            for source_line, target_line, fragment in untranslated_fragments(
                source_text, text
            ):
                result.add(
                    "translation-untranslated-prose",
                    target_path,
                    f"target line {target_line} retains source line "
                    f"{source_line}: {fragment!r}",
                )
            for line_number, column, fragment in untranslated_table_cells(
                source_text, text
            ):
                result.add(
                    "translation-untranslated-table",
                    target_path,
                    f"target line {line_number}, column {column} retains: "
                    f"{fragment!r}",
                )
            if lang == "zh":
                for line_number, fragment in suspicious_repetitions(text):
                    result.add(
                        "translation-repetition",
                        target_path,
                        f"target line {line_number} repeats {fragment[:40]!r}",
                    )

    return result


def render_report(result: AuditResult) -> str:
    lines = [
        f"Translation audit: lang={result.lang}, source={result.source_label}",
        f"  canonical documents: {result.canonical_count}",
        "  translation documents: "
        f"{result.found_translation_count} found / "
        f"{result.expected_translation_count} expected "
        f"({result.checked_translation_count} content-checked)",
        "  cache: "
        f"{result.cache_file_count} file(s), "
        f"{result.found_cache_key_count} key(s) found / "
        f"{result.expected_cache_key_count} expected",
        f"  errors: {len(result.issues)}",
    ]
    if result.issues:
        lines.append("")
        lines.extend(
            f"  [{issue.rule}] {issue.path}: {issue.message}" for issue in result.issues
        )
        lines.append("")
        lines.append("FAIL: translation audit found errors")
    else:
        lines.append("PASS: translation audit clean")
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lang", required=True, help="translation language code, e.g. zh")
    parser.add_argument(
        "--phase",
        help="limit the audit to one phase directory, e.g. 05-nlp-foundations-to-advanced",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=ROOT,
        help=argparse.SUPPRESS,
    )
    source_group = parser.add_mutually_exclusive_group()
    source_group.add_argument(
        "--translation-ref",
        "--ref",
        dest="translation_ref",
        help=f"git ref containing i18n/ (default: {DEFAULT_TRANSLATION_REF})",
    )
    source_group.add_argument(
        "--translation-root",
        "--root",
        dest="translation_root",
        type=Path,
        help="local directory containing i18n/ instead of a git ref",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    repo_root = args.repo_root.resolve()
    try:
        args.lang = validate_language(args.lang, allow_manual=True)
        args.phase = validate_phase(repo_root, args.phase)
    except ValueError as exc:
        parser.error(str(exc))
    if args.translation_root is not None:
        source: TranslationSource = LocalTranslationSource(args.translation_root.resolve())
    else:
        source = GitTranslationSource(
            repo_root, args.translation_ref or DEFAULT_TRANSLATION_REF
        )
    try:
        result = audit_translations(repo_root, args.lang, source, args.phase)
    except TranslationSourceError as exc:
        print(
            f"Translation audit: lang={args.lang}, source={source.label}\n"
            f"ERROR: {exc}",
            file=sys.stderr,
        )
        return 2
    print(render_report(result))
    return 1 if result.issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
