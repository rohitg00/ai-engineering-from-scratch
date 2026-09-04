#!/usr/bin/env python3
"""Build a skill catalog from NAME=PATH scopes, highest precedence first."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def frontmatter(path: Path) -> dict[str, str] | None:
    lines: list[str] = []
    consumed = 0
    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            consumed += len(raw_line.encode("utf-8"))
            if consumed > 8_192:
                raise ValueError(f"frontmatter exceeds 8192 bytes: {path}")
            lines.append(raw_line.rstrip("\r\n"))
            if len(lines) > 1 and lines[-1] == "---":
                break
    if not lines or lines[0] != "---" or lines[-1] != "---":
        return None
    end = len(lines) - 1
    fields: dict[str, str] = {}
    index = 1
    while index < end:
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            index += 1
            continue
        if line[:1].isspace() or ":" not in line:
            raise ValueError(f"malformed top-level line {index + 1} in {path}")
        key, value = line.split(":", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", key):
            raise ValueError(f"invalid frontmatter field {key!r} in {path}")
        if key in fields:
            raise ValueError(f"duplicate frontmatter field {key!r} in {path}")
        value = value.strip()
        if key == "metadata" and not value:
            nested: dict[str, str] = {}
            index += 1
            while index < end and (not lines[index] or lines[index][:1].isspace()):
                nested_line = lines[index].strip()
                if nested_line:
                    if ":" not in nested_line:
                        raise ValueError(
                            f"malformed metadata line {index + 1} in {path}"
                        )
                    nested_key, nested_value = nested_line.split(":", 1)
                    nested_key = nested_key.strip()
                    if (
                        not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", nested_key)
                        or nested_key in nested
                    ):
                        raise ValueError(
                            f"invalid metadata field {nested_key!r} in {path}"
                        )
                    nested[nested_key] = nested_value.strip().strip("\"'")
                index += 1
            fields[key] = json.dumps(nested, sort_keys=True)
            continue
        if value in {">", "|"}:
            block: list[str] = []
            index += 1
            while index < end and (not lines[index] or lines[index][:1].isspace()):
                block.append(lines[index].lstrip())
                index += 1
            fields[key] = (" " if value == ">" else "\n").join(block).strip()
            continue
        fields[key] = value.strip("\"'")
        index += 1
    return fields


def parse_scope(value: str) -> tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("scope must use NAME=PATH")
    name, raw_path = value.split("=", 1)
    if not name or not raw_path:
        raise argparse.ArgumentTypeError("scope name and path cannot be empty")
    return name, Path(raw_path).resolve()


def shorten(value: str, limit: int) -> str:
    if limit < 1:
        return ""
    if len(value) <= limit:
        return value
    if limit == 1:
        return "…"
    return value[: limit - 1].rstrip() + "…"


def build(
    scopes: list[tuple[str, Path]],
    max_entries: int,
    max_description_chars: int = 240,
    max_catalog_chars: int = 8_000,
) -> dict[str, object]:
    selected: dict[str, dict[str, str]] = {}
    collisions: list[dict[str, str]] = []
    errors: list[str] = []
    rank_by_scope: dict[str, int] = {}
    for scope, _ in scopes:
        rank_by_scope.setdefault(scope, len(rank_by_scope))
    for scope, root in scopes:
        rank = rank_by_scope[scope]
        if not root.is_dir():
            continue
        for directory in sorted(root.iterdir(), key=lambda item: item.name):
            skill_path = directory / "SKILL.md"
            if not directory.is_dir() or directory.is_symlink():
                continue
            if skill_path.is_symlink():
                errors.append(f"symlinked SKILL.md is not allowed: {skill_path}")
                continue
            if not skill_path.is_file():
                continue
            try:
                fields = frontmatter(skill_path)
            except ValueError as error:
                errors.append(str(error))
                continue
            if not fields or not fields.get("name") or not fields.get("description"):
                continue
            name = fields["name"]
            if len(name) > 64 or not NAME_PATTERN.fullmatch(name):
                errors.append(
                    f"frontmatter name {name!r} is not valid portable kebab-case"
                )
                continue
            if len(fields["description"]) > 1024:
                errors.append(f"description exceeds 1024 characters: {skill_path}")
                continue
            if name != directory.name:
                errors.append(
                    f"frontmatter name {name!r} does not match directory {directory.name!r}"
                )
                continue
            candidate = {
                "name": name,
                "description": fields["description"],
                "scope": scope,
                "path": str(directory.resolve()),
                "rank": str(rank),
            }
            if name in selected:
                if selected[name]["rank"] == str(rank):
                    errors.append(
                        f"equal-precedence duplicate {name!r} in scope {scope!r}"
                    )
                    continue
                collisions.append({"name": name, "winner": selected[name]["scope"], "shadowed": scope})
            else:
                selected[name] = candidate
    ordered = sorted(selected.values(), key=lambda item: (int(item["rank"]), item["name"]))
    entries = [
        {
            "name": entry["name"],
            "description": shorten(entry["description"], max_description_chars),
            "scope": entry["scope"],
            "path": entry["path"],
        }
        for entry in ordered[:max_entries]
    ]
    omitted = [entry["name"] for entry in ordered[max_entries:]]

    def result_with_size(catalog_chars: int, report_chars: int) -> dict[str, object]:
        return {
            "valid": not errors,
            "precedence": list(dict.fromkeys(scope for scope, _ in scopes)),
            "entries": entries,
            "collisions": collisions,
            "omitted": omitted,
            "errors": errors,
            "budget": {
                "maxEntries": max_entries,
                "maxDescriptionChars": max_description_chars,
                "maxCatalogChars": max_catalog_chars,
                "catalogChars": catalog_chars,
                "reportChars": report_chars,
            },
        }

    def model_size() -> int:
        return len(
            json.dumps({"entries": entries}, sort_keys=True, separators=(",", ":"))
        )

    used = model_size()
    while used > max_catalog_chars and entries:
        removed = entries.pop()
        omitted.insert(0, str(removed["name"]))
        used = model_size()
    if used > max_catalog_chars:
        errors.append("model-facing catalog exceeds maxCatalogChars")

    report_chars = 0
    while True:
        result = result_with_size(used, report_chars)
        measured = len(json.dumps(result, sort_keys=True, separators=(",", ":")))
        if measured == report_chars:
            return result
        report_chars = measured


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "scopes",
        nargs="+",
        type=parse_scope,
        metavar="NAME=PATH",
        help="scope roots in precedence order, highest precedence first",
    )
    parser.add_argument("--max-entries", type=int, default=40)
    parser.add_argument("--max-description-chars", type=int, default=240)
    parser.add_argument("--max-catalog-chars", type=int, default=8000)
    args = parser.parse_args()
    if min(args.max_entries, args.max_description_chars, args.max_catalog_chars) < 1:
        parser.error("all catalog budgets must be positive")
    result = build(
        args.scopes,
        args.max_entries,
        args.max_description_chars,
        args.max_catalog_chars,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["valid"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
