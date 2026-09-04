"""Phase 13 Lesson 04 - structured output, JSON Schema 2020-12 subset.

Stdlib JSON Schema validator supporting type, required, enum, minimum,
maximum, minLength, maxLength, pattern, items, and additionalProperties.
Wrapped around an Invoice schema to show the three failure modes:

  - parse error (invalid JSON; impossible in strict mode)
  - schema violation (parsed but wrong)
  - refusal (model declined; handled as typed outcome)

Run: python code/main.py
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any


INVOICE_SCHEMA = {
    "type": "object",
    "properties": {
        "customer": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200,
        },
        "line_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "pattern": "^[A-Z0-9-]+$"},
                    "qty": {"type": "integer", "minimum": 1},
                    "unit_usd": {"type": "number", "minimum": 0},
                },
                "required": ["sku", "qty", "unit_usd"],
                "additionalProperties": False,
            },
        },
        "total_usd": {"type": "number", "minimum": 0},
        "currency": {"type": "string", "enum": ["USD", "EUR", "INR"]},
    },
    "required": ["customer", "line_items", "total_usd", "currency"],
    "additionalProperties": False,
}


@dataclass
class ValidationError:
    path: str
    message: str

    def __str__(self) -> str:
        return f"{self.path}: {self.message}"


def validate(schema: dict, value: Any, path: str = "$") -> list[ValidationError]:
    errors: list[ValidationError] = []
    t = schema.get("type")
    if t == "object":
        if not isinstance(value, dict):
            return [ValidationError(path, f"expected object, got {type(value).__name__}")]
        required = schema.get("required", [])
        props = schema.get("properties", {})
        for field in required:
            if field not in value:
                errors.append(ValidationError(f"{path}.{field}", "missing required field"))
        if schema.get("additionalProperties") is False:
            extras = set(value) - set(props)
            for extra in extras:
                errors.append(ValidationError(f"{path}.{extra}", "additional property not allowed"))
        for key, sub in props.items():
            if key in value:
                errors.extend(validate(sub, value[key], f"{path}.{key}"))
        return errors
    if t == "array":
        if not isinstance(value, list):
            return [ValidationError(path, f"expected array, got {type(value).__name__}")]
        item_schema = schema.get("items")
        if item_schema is not None:
            for i, item in enumerate(value):
                errors.extend(validate(item_schema, item, f"{path}[{i}]"))
        return errors
    if t == "string":
        if not isinstance(value, str):
            errors.append(ValidationError(path, f"expected string, got {type(value).__name__}"))
            return errors
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(ValidationError(path, f"shorter than minLength {schema['minLength']}"))
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(ValidationError(path, f"longer than maxLength {schema['maxLength']}"))
        if "pattern" in schema and not re.match(schema["pattern"], value):
            errors.append(ValidationError(path, f"does not match pattern {schema['pattern']!r}"))
    elif t == "number":
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            errors.append(ValidationError(path, f"expected number, got {type(value).__name__}"))
            return errors
    elif t == "integer":
        if not isinstance(value, int) or isinstance(value, bool):
            errors.append(ValidationError(path, f"expected integer, got {type(value).__name__}"))
            return errors
    elif t == "boolean":
        if not isinstance(value, bool):
            errors.append(ValidationError(path, f"expected boolean, got {type(value).__name__}"))
            return errors
    if "minimum" in schema and isinstance(value, (int, float)) and value < schema["minimum"]:
        errors.append(ValidationError(path, f"below minimum {schema['minimum']}"))
    if "maximum" in schema and isinstance(value, (int, float)) and value > schema["maximum"]:
        errors.append(ValidationError(path, f"above maximum {schema['maximum']}"))
    if "enum" in schema and value not in schema["enum"]:
        errors.append(ValidationError(path, f"value {value!r} not in enum {schema['enum']}"))
    return errors


@dataclass
class ParsedResult:
    kind: str
    payload: Any
    errors: list[ValidationError]


def process_model_output(raw: str, schema: dict) -> ParsedResult:
    """Three-branch handler: parse error, refusal, success/violation."""
    if raw.startswith("__REFUSAL__"):
        return ParsedResult("refusal", raw.removeprefix("__REFUSAL__").strip(), [])
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return ParsedResult("parse_error", None, [ValidationError("$", str(e))])
    errs = validate(schema, parsed)
    if errs:
        return ParsedResult("violation", parsed, errs)
    return ParsedResult("ok", parsed, [])


TEST_CASES = [
    (
        "happy path",
        json.dumps({
            "customer": "Acme Corp",
            "line_items": [
                {"sku": "ABC-123", "qty": 2, "unit_usd": 49.99},
                {"sku": "XYZ-9", "qty": 1, "unit_usd": 120.00},
            ],
            "total_usd": 219.98,
            "currency": "USD",
        }),
    ),
    (
        "parse error (trailing comma)",
        '{"customer": "Acme", "line_items": [], "total_usd": 0, "currency": "USD",}',
    ),
    (
        "schema violation (extra field, bad sku)",
        json.dumps({
            "customer": "Acme",
            "line_items": [{"sku": "abc_123", "qty": 1, "unit_usd": 10, "discount": 0.1}],
            "total_usd": 10,
            "currency": "USD",
        }),
    ),
    (
        "schema violation (missing required)",
        json.dumps({"customer": "Acme", "line_items": []}),
    ),
    (
        "refusal (model declined)",
        "__REFUSAL__ The provided text is a song lyric, not an invoice.",
    ),
]


def main() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 04 - STRUCTURED OUTPUT")
    print("=" * 72)
    print("\nInvoice schema keys:",
          list(INVOICE_SCHEMA["properties"].keys()))
    print()

    for name, raw in TEST_CASES:
        print("-" * 72)
        print(f"TEST : {name}")
        print(f"  raw: {raw[:80]}...")
        result = process_model_output(raw, INVOICE_SCHEMA)
        print(f"  kind: {result.kind}")
        if result.kind == "ok":
            print(f"  payload customer = {result.payload['customer']}")
            print(f"  total_usd        = {result.payload['total_usd']}")
        elif result.kind == "refusal":
            print(f"  reason: {result.payload}")
        else:
            for e in result.errors:
                print(f"  error: {e}")
        print()

    print("summary: strict-mode eliminates parse_error and violation branches")
    print("at the provider level; your code still handles refusal as typed outcome.")


if __name__ == "__main__":
    main()
