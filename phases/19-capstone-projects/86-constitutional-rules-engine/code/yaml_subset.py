"""Minimal YAML subset parser sufficient for the constitution file.

Supports:
- nested block mappings with two-space indentation
- block sequences ('- key: value' style)
- string scalars (plain, single-quoted, double-quoted)
- integer scalars
- inline list values on the right of ':' for simple atoms
- comments after '#' on a line

Does NOT support: anchors, aliases, tags, flow style, multi-doc, multi-line
folded/literal blocks. The constitution format avoids those by design.

If PyYAML is installed it is preferred via load_yaml; this fallback exists so
the lesson runs on any standard Python install.
"""

from __future__ import annotations

import re
from typing import Any


def load_yaml(text: str) -> Any:
    try:
        import yaml  # type: ignore[import-not-found]
        return yaml.safe_load(text)
    except ModuleNotFoundError:
        return _parse(text)


def _strip_comment(line: str) -> str:
    in_single = False
    in_double = False
    for i, ch in enumerate(line):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            return line[:i]
    return line


def _indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _coerce(value: str) -> Any:
    s = value.strip()
    if s == "":
        return None
    if s == "{}":
        return {}
    if s == "[]":
        return []
    if s in ("true", "True"):
        return True
    if s in ("false", "False"):
        return False
    if s in ("null", "None", "~"):
        return None
    if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
        inner = s[1:-1]
        if s[0] == '"':
            inner = inner.encode("utf-8").decode("unicode_escape")
        return inner
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    return s


def _parse(text: str) -> Any:
    raw_lines = []
    for raw in text.splitlines():
        stripped = _strip_comment(raw).rstrip()
        if stripped.strip() == "":
            continue
        raw_lines.append(stripped)
    if not raw_lines:
        return None
    return _parse_block(raw_lines, 0, _indent_of(raw_lines[0]))[0]


def _parse_block(lines: list[str], start: int, indent: int) -> tuple[Any, int]:
    if start >= len(lines):
        return None, start
    first = lines[start]
    cur_indent = _indent_of(first)
    if cur_indent < indent:
        return None, start
    stripped = first.lstrip()
    if stripped.startswith("- "):
        return _parse_sequence(lines, start, cur_indent)
    return _parse_mapping(lines, start, cur_indent)


def _parse_mapping(lines: list[str], start: int, indent: int) -> tuple[dict[str, Any], int]:
    out: dict[str, Any] = {}
    i = start
    while i < len(lines):
        line = lines[i]
        cur_indent = _indent_of(line)
        if cur_indent < indent:
            break
        if cur_indent > indent:
            i += 1
            continue
        stripped = line.lstrip()
        if stripped.startswith("- "):
            break
        m = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", stripped)
        if not m:
            raise ValueError(f"malformed line: {line!r}")
        key = m.group(1)
        rest = m.group(2)
        if rest.strip() == "":
            if i + 1 < len(lines) and _indent_of(lines[i + 1]) > indent:
                value, i = _parse_block(lines, i + 1, _indent_of(lines[i + 1]))
                out[key] = value
                continue
            out[key] = None
            i += 1
        else:
            out[key] = _coerce(rest)
            i += 1
    return out, i


def _parse_sequence(lines: list[str], start: int, indent: int) -> tuple[list[Any], int]:
    out: list[Any] = []
    i = start
    while i < len(lines):
        line = lines[i]
        cur_indent = _indent_of(line)
        if cur_indent < indent:
            break
        stripped = line.lstrip()
        if not stripped.startswith("- "):
            break
        if cur_indent > indent:
            i += 1
            continue
        rest = stripped[2:]
        m = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", rest)
        if m:
            child_indent = indent + 2
            synthetic = " " * child_indent + rest
            j = i + 1
            extra_lines = []
            while j < len(lines) and _indent_of(lines[j]) > indent and not lines[j].lstrip().startswith("- "):
                extra_lines.append(lines[j])
                j += 1
            block = [synthetic] + extra_lines
            value, _ = _parse_mapping(block, 0, child_indent)
            out.append(value)
            i = j
        else:
            out.append(_coerce(rest))
            i += 1
    return out, i
