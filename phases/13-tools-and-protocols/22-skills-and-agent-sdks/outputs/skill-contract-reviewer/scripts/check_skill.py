#!/usr/bin/env python3
"""Read-only, stdlib-only validator for the core identity of a SKILL.md."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CORE_FIELDS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}


def validate(directory: Path) -> dict[str, object]:
    errors: list[dict[str, str]] = []
    path = directory / "SKILL.md"
    fields: dict[str, object] = {}
    body = ""
    if not path.is_file() or path.is_symlink():
        errors.append({"code": "skill-file", "message": "regular SKILL.md is required"})
    else:
        lines = path.read_text(encoding="utf-8").splitlines()
        if not lines or lines[0] != "---" or "---" not in lines[1:]:
            errors.append({"code": "frontmatter", "message": "exact delimiters are required"})
        else:
            end = lines.index("---", 1)
            index = 1
            while index < end:
                line = lines[index]
                if not line.strip() or line.lstrip().startswith("#"):
                    index += 1
                    continue
                if line[:1].isspace() or ":" not in line:
                    errors.append(
                        {
                            "code": "frontmatter-syntax",
                            "message": f"malformed top-level line {index + 1}",
                        }
                    )
                    index += 1
                    continue
                key, value = line.split(":", 1)
                key, value = key.strip(), value.strip()
                if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", key):
                    errors.append(
                        {
                            "code": "frontmatter-syntax",
                            "message": f"invalid field name {key!r}",
                        }
                    )
                    index += 1
                    continue
                if key in fields:
                    errors.append({"code": "duplicate", "message": f"duplicate {key} on line {index + 1}"})
                if value in {">", "|"}:
                    block: list[str] = []
                    index += 1
                    while index < end and (not lines[index] or lines[index][:1].isspace()):
                        block.append(lines[index].lstrip())
                        index += 1
                    fields[key] = (" " if value == ">" else "\n").join(block).strip()
                    continue
                if key == "metadata" and not value:
                    nested: dict[str, str] = {}
                    index += 1
                    while index < end and (
                        not lines[index] or lines[index][:1].isspace()
                    ):
                        nested_line = lines[index].strip()
                        if nested_line:
                            if ":" not in nested_line:
                                errors.append(
                                    {
                                        "code": "metadata-shape",
                                        "message": f"malformed metadata on line {index + 1}",
                                    }
                                )
                            else:
                                nested_key, nested_value = nested_line.split(":", 1)
                                nested_key = nested_key.strip()
                                if nested_key in nested:
                                    errors.append(
                                        {
                                            "code": "duplicate",
                                            "message": f"duplicate metadata field {nested_key!r}",
                                        }
                                    )
                                nested[nested_key] = nested_value.strip().strip("\"'")
                        index += 1
                    fields[key] = nested
                    continue
                fields[key] = value.strip("\"'")
                index += 1
            body = "\n".join(lines[end + 1 :]).strip()

    name_value = fields.get("name", "")
    description_value = fields.get("description", "")
    name = name_value if isinstance(name_value, str) else ""
    description = description_value if isinstance(description_value, str) else ""
    if not name:
        errors.append({"code": "name-required", "message": "name is required"})
    elif len(name) > 64 or not NAME_PATTERN.fullmatch(name):
        errors.append({"code": "name-format", "message": "name must be kebab-case and at most 64 characters"})
    elif name != directory.name:
        errors.append({"code": "directory-mismatch", "message": "name must match the directory"})
    if not description:
        errors.append({"code": "description-required", "message": "description is required"})
    elif len(description) > 1024:
        errors.append({"code": "description-length", "message": "description exceeds 1024 characters"})
    if "compatibility" in fields:
        compatibility = fields["compatibility"]
        if not isinstance(compatibility, str) or not 1 <= len(compatibility) <= 500:
            errors.append(
                {
                    "code": "compatibility-length",
                    "message": "compatibility must contain 1 to 500 characters",
                }
            )
    if "metadata" in fields and not isinstance(fields["metadata"], dict):
        errors.append(
            {
                "code": "metadata-shape",
                "message": "metadata must map string keys to string values",
            }
        )
    if "allowed-tools" in fields:
        allowed_tools = fields["allowed-tools"]
        if not isinstance(allowed_tools, str) or not allowed_tools.strip():
            errors.append(
                {
                    "code": "allowed-tools-shape",
                    "message": "allowed-tools must be a non-empty space-separated string",
                }
            )
    for unknown in sorted(set(fields) - CORE_FIELDS):
        errors.append(
            {
                "code": "unsupported-field",
                "message": f"{unknown!r} is not in the portable core",
            }
        )
    if not body:
        errors.append({"code": "body-required", "message": "instruction body is required"})
    return {
        "path": str(directory),
        "valid": not errors,
        "name": name or None,
        "description": description or None,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="bundle directory containing SKILL.md")
    args = parser.parse_args()
    result = validate(args.directory.resolve())
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["valid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
