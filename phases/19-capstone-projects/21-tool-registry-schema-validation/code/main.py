"""JSON Schema 2020-12 subset validation つき tool registry。

Conceptual references:
- ./docs/en.md (this lesson)
- IETF draft draft-bhutton-json-schema-2020-12 (subset: type, properties,
  required, enum, minLength, maxLength, pattern, items)
- RFC 6901 (error path のための JSON Pointer)

stdlib のみ。実行: python3 code/main.py
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable


PRIMITIVE_TYPE_MAP: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
    "object": (dict,),
    "array": (list,),
    "null": (type(None),),
}

ALLOWED_KEYWORDS = {
    "type", "properties", "required", "enum",
    "minLength", "maxLength", "pattern", "items", "description",
}


@dataclass
class ValidationError:
    path: str
    keyword: str
    message: str

    def to_dict(self) -> dict:
        return {"path": self.path, "keyword": self.keyword, "message": self.message}


@dataclass
class Ok:
    pass


@dataclass
class ToolRecord:
    name: str
    description: str
    schema: dict
    handler: Callable[..., Any]
    idempotent: bool = False
    timeout_ms: int = 30_000


class ToolRegistry:
    """schema validation を備えた、name keyed な tool record table。"""

    _NAME_RE = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$")

    def __init__(self) -> None:
        self._records: dict[str, ToolRecord] = {}
        self._order: list[str] = []

    def register(
        self,
        name: str,
        schema: dict,
        handler: Callable[..., Any],
        description: str = "",
        idempotent: bool = False,
        timeout_ms: int = 30_000,
        override: bool = False,
    ) -> ToolRecord:
        if not self._NAME_RE.match(name):
            raise ValueError(f"tool name {name!r} は {self._NAME_RE.pattern} に match する必要があります")
        if name in self._records and not override:
            raise ValueError(f"tool {name!r} は登録済みです。置き換えるには override=True を渡してください")
        validate_schema_shape(schema)
        rec = ToolRecord(
            name=name, description=description, schema=schema, handler=handler,
            idempotent=idempotent, timeout_ms=timeout_ms,
        )
        if name not in self._records:
            self._order.append(name)
        self._records[name] = rec
        return rec

    def get(self, name: str) -> ToolRecord:
        if name not in self._records:
            raise KeyError(f"未知の tool {name!r}")
        return self._records[name]

    def names(self) -> list[str]:
        return list(self._order)

    def validate(self, name: str, args: Any) -> Ok | list[ValidationError]:
        rec = self.get(name)
        errors: list[ValidationError] = []
        _walk(rec.schema, args, "", errors)
        if errors:
            return errors
        return Ok()


def validate_schema_shape(schema: dict) -> None:
    """supported subset 外の keyword を使う schema を拒否する。"""
    if not isinstance(schema, dict):
        raise ValueError("schema は dict である必要があります")
    unknown = set(schema.keys()) - ALLOWED_KEYWORDS
    if unknown:
        raise ValueError(f"未サポートの schema keyword: {sorted(unknown)}")
    t = schema.get("type")
    if t is not None and t not in PRIMITIVE_TYPE_MAP:
        raise ValueError(f"未サポートの type: {t!r}")
    enum_vals = schema.get("enum")
    if enum_vals is not None and not isinstance(enum_vals, list):
        raise ValueError("enum は list である必要があります")
    min_len = schema.get("minLength")
    if min_len is not None:
        if isinstance(min_len, bool) or not isinstance(min_len, int) or min_len < 0:
            raise ValueError("minLength は non-negative integer である必要があります")
    max_len = schema.get("maxLength")
    if max_len is not None:
        if isinstance(max_len, bool) or not isinstance(max_len, int) or max_len < 0:
            raise ValueError("maxLength は non-negative integer である必要があります")
    if min_len is not None and max_len is not None and min_len > max_len:
        raise ValueError("minLength は maxLength より大きくできません")
    pattern = schema.get("pattern")
    if pattern is not None and not isinstance(pattern, str):
        raise ValueError("pattern は string である必要があります")
    props = schema.get("properties")
    if props is not None:
        if not isinstance(props, dict):
            raise ValueError("properties は dict である必要があります")
        for pname, psub in props.items():
            if not isinstance(pname, str):
                raise ValueError("property name は string である必要があります")
            validate_schema_shape(psub)
    items = schema.get("items")
    if items is not None:
        validate_schema_shape(items)
    req = schema.get("required")
    if req is not None:
        if not isinstance(req, list) or not all(isinstance(x, str) for x in req):
            raise ValueError("required は list[str] である必要があります")


def _path(prefix: str, segment: str | int) -> str:
    seg = str(segment).replace("~", "~0").replace("/", "~1")
    return f"{prefix}/{seg}"


def _type_matches(value: Any, expected: str) -> bool:
    types = PRIMITIVE_TYPE_MAP[expected]
    if expected == "boolean":
        return isinstance(value, bool)
    if expected in ("integer", "number"):
        if isinstance(value, bool):
            return False
        return isinstance(value, types)
    return isinstance(value, types)


def _walk(schema: dict, value: Any, path: str, errs: list[ValidationError]) -> None:
    t = schema.get("type")
    if t is not None and not _type_matches(value, t):
        errs.append(ValidationError(
            path=path or "/",
            keyword="type",
            message=f"{t} を期待しましたが {type(value).__name__} でした",
        ))
        return
    if "enum" in schema:
        if value not in schema["enum"]:
            errs.append(ValidationError(
                path=path or "/",
                keyword="enum",
                message=f"value {value!r} は {schema['enum']!r} に含まれていません",
            ))
            return
    if t == "string":
        _check_string(schema, value, path, errs)
    elif t == "object":
        _check_object(schema, value, path, errs)
    elif t == "array":
        _check_array(schema, value, path, errs)


def _check_string(schema: dict, value: str, path: str, errs: list[ValidationError]) -> None:
    if "minLength" in schema and len(value) < schema["minLength"]:
        errs.append(ValidationError(
            path=path or "/", keyword="minLength",
            message=f"length {len(value)} < minLength {schema['minLength']}",
        ))
    if "maxLength" in schema and len(value) > schema["maxLength"]:
        errs.append(ValidationError(
            path=path or "/", keyword="maxLength",
            message=f"length {len(value)} > maxLength {schema['maxLength']}",
        ))
    if "pattern" in schema:
        try:
            if not re.search(schema["pattern"], value):
                errs.append(ValidationError(
                    path=path or "/", keyword="pattern",
                    message=f"value {value!r} は pattern {schema['pattern']!r} に match しません",
                ))
        except re.error as exc:
            errs.append(ValidationError(
                path=path or "/", keyword="pattern",
                message=f"不正な regex: {exc}",
            ))


def _check_object(schema: dict, value: dict, path: str, errs: list[ValidationError]) -> None:
    required = schema.get("required", [])
    for req_name in required:
        if req_name not in value:
            errs.append(ValidationError(
                path=_path(path, req_name),
                keyword="required",
                message=f"required property {req_name!r} がありません",
            ))
    props = schema.get("properties", {})
    for prop_name, prop_value in value.items():
        if prop_name in props:
            _walk(props[prop_name], prop_value, _path(path, prop_name), errs)


def _check_array(schema: dict, value: list, path: str, errs: list[ValidationError]) -> None:
    items_schema = schema.get("items")
    if items_schema is None:
        return
    for idx, item in enumerate(value):
        _walk(items_schema, item, _path(path, idx), errs)


def _demo() -> None:
    registry = ToolRegistry()

    def get_user(id: int) -> dict:
        return {"id": id, "name": "ada"}

    registry.register(
        name="db.get_user",
        description="id で user record を取得する。",
        schema={
            "type": "object",
            "required": ["id"],
            "properties": {
                "id": {"type": "integer"},
                "fields": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["id", "name", "email"]},
                },
            },
        },
        handler=get_user,
        idempotent=True,
    )

    cases = [
        {"id": 42, "fields": ["id", "name"]},
        {"id": "四十二"},
        {"fields": ["id"]},
        {"id": 1, "fields": ["id", "phone"]},
    ]
    report = []
    for c in cases:
        result = registry.validate("db.get_user", c)
        if isinstance(result, Ok):
            report.append({"args": c, "ok": True})
        else:
            report.append({"args": c, "ok": False, "errors": [e.to_dict() for e in result]})
    print(json.dumps({"tools": registry.names(), "cases": report}, indent=2))


if __name__ == "__main__":
    _demo()
