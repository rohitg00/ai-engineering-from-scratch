"""Companion code for:
certifications/claude/lessons/09-structured-output-and-defensive-parsing/docs/en.md
It demonstrates schema-first parsing, validation, and bounded repair.
Concepts follow official Anthropic structured-output documentation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class ValidationIssue:
    path: str
    message: str


class ContractError(ValueError):
    def __init__(self, issues: list[ValidationIssue]) -> None:
        self.issues = issues
        super().__init__("; ".join(f"{item.path}: {item.message}" for item in issues))


TRIAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["category", "priority", "summary", "needs_human"],
    "additionalProperties": False,
    "properties": {
        "category": {"type": "string", "enum": ["billing", "bug", "account", "other"]},
        "priority": {"type": "integer", "minimum": 1, "maximum": 5},
        "summary": {"type": "string", "minLength": 1, "maxLength": 240},
        "needs_human": {"type": "boolean"},
    },
}


def parse_and_validate(raw: str, schema: dict[str, Any]) -> Any:
    """Accept exactly one JSON value, then validate the supported schema subset."""
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ContractError([ValidationIssue("$", f"invalid JSON at character {exc.pos}")]) from exc
    issues = validate(value, schema)
    if issues:
        raise ContractError(issues)
    return value


def validate(value: Any, schema: dict[str, Any], path: str = "$") -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    expected = schema.get("type")
    if expected == "object":
        if not isinstance(value, dict):
            return [ValidationIssue(path, "expected object")]
        properties = schema.get("properties", {})
        for name in schema.get("required", []):
            if name not in value:
                issues.append(ValidationIssue(f"{path}.{name}", "required field is missing"))
        if schema.get("additionalProperties") is False:
            for name in value:
                if name not in properties:
                    issues.append(ValidationIssue(f"{path}.{name}", "unexpected field"))
        for name, child in properties.items():
            if name in value:
                issues.extend(validate(value[name], child, f"{path}.{name}"))
        return issues

    type_ok = {
        "string": lambda item: isinstance(item, str),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "boolean": lambda item: isinstance(item, bool),
        "array": lambda item: isinstance(item, list),
    }.get(expected, lambda _item: True)(value)
    if not type_ok:
        return [ValidationIssue(path, f"expected {expected}")]

    if "enum" in schema and value not in schema["enum"]:
        issues.append(ValidationIssue(path, f"must be one of {schema['enum']}"))
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            issues.append(ValidationIssue(path, f"must be at least {schema['minimum']}"))
        if "maximum" in schema and value > schema["maximum"]:
            issues.append(ValidationIssue(path, f"must be at most {schema['maximum']}"))
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            issues.append(ValidationIssue(path, "string is too short"))
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            issues.append(ValidationIssue(path, "string is too long"))
    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            issues.extend(validate(item, schema["items"], f"{path}[{index}]"))
    return issues


class BoundedExtractor:
    """Call a model-like function and request repair only within a fixed budget."""

    def __init__(self, generate: Callable[[str], str], schema: dict[str, Any], max_attempts: int = 2) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        self.generate = generate
        self.schema = schema
        self.max_attempts = max_attempts

    def extract(self, task: str) -> dict[str, Any]:
        feedback = ""
        last_error: ContractError | None = None
        for _attempt in range(self.max_attempts):
            prompt = task if not feedback else f"{task}\nRepair the previous output. Validation errors:\n{feedback}"
            raw = self.generate(prompt)
            try:
                value = parse_and_validate(raw, self.schema)
                if not isinstance(value, dict):
                    raise AssertionError("object schema returned non-object")
                return value
            except ContractError as exc:
                last_error = exc
                feedback = "\n".join(f"- {issue.path}: {issue.message}" for issue in exc.issues)
        assert last_error is not None
        raise last_error


def demo() -> dict[str, Any]:
    responses = iter([
        '{"category":"bug","priority":"high","summary":"App crashes","needs_human":true}',
        '{"category":"bug","priority":4,"summary":"App crashes after login","needs_human":true}',
    ])
    return BoundedExtractor(lambda _prompt: next(responses), TRIAGE_SCHEMA).extract("Classify the support ticket")


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2, sort_keys=True))
