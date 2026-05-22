"""Shared helpers for scripts/ tools.

Currently provides:
- parse_frontmatter: minimal YAML-subset parser for `--- ... ---` blocks in markdown.

No external dependencies. Python 3.10+ (PEP 604 unions in type hints).
"""

from __future__ import annotations


def parse_frontmatter(text: str) -> dict[str, object] | None:
    """Parse a YAML-subset frontmatter block at the top of a markdown string.

    Returns the parsed key/value mapping, or None when no frontmatter is present
    or the closing `---` is missing.

    Supports:
    - bare strings: `key: value`
    - single-quoted: `key: 'value'`
    - double-quoted: `key: "value"`
    - lists: `key: [a, b, "c"]`
    - inline comment lines beginning with `#`
    """
    if not text.startswith("---\n"):
        return None
    # Closing delimiter: "\n---\n" inside the file, or "\n---" at EOF.
    end = text.find("\n---\n", 4)
    if end == -1 and text.endswith("\n---"):
        end = len(text) - 4
    if end == -1:
        return None
    block = text[4:end].strip("\n")
    result: dict[str, object] = {}
    for raw in block.splitlines():
        # Anchor at column 0: skip comments + indented lines.
        if not raw or raw.startswith("#") or raw[0] in (" ", "\t"):
            continue
        if ":" not in raw:
            continue
        key, _, value = raw.partition(":")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            result[key] = (
                [item.strip().strip("'\"") for item in inner.split(",") if item.strip()]
                if inner
                else []
            )
        elif (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            result[key] = value[1:-1]
        else:
            result[key] = value
    return result
