"""Tool Contract Migration Checker - Core Implementation."""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

ANNOTATION_KEYWORDS = {
    "$schema",
    "$comment",
    "title",
    "description",
    "default",
    "examples",
    "deprecated",
    "readOnly",
    "writeOnly",
}

ROOT_KEYWORDS = {"type", "properties", "required", "additionalProperties"}

PROPERTY_KEYWORDS = {
    "type",
    "enum",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
}

NESTED_KEYWORDS = {"properties", "required", "additionalProperties", "items"}

_MISSING = object()


def _changed_keywords(old: Dict[str, Any], new: Dict[str, Any], keywords: Set[str]) -> List[str]:
    """Return the given keywords whose values differ between two schemas, sorted."""
    return sorted(k for k in keywords if old.get(k, _MISSING) != new.get(k, _MISSING))


def _nested_view(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Return the nested object and array keywords of a property schema with their defaults filled in."""
    required = schema.get("required", [])
    if isinstance(required, list) and all(isinstance(r, str) for r in required):
        required = sorted(set(required))
    view = {
        "properties": schema.get("properties", {}),
        "required": required,
        "additionalProperties": schema.get("additionalProperties", True),
    }
    if "items" in schema:
        view["items"] = schema["items"]
    return view


def _unhandled_keywords(old: Dict[str, Any], new: Dict[str, Any], handled: Set[str]) -> List[str]:
    """Return keywords outside the handled and annotation sets whose values differ, sorted."""
    candidates = (set(old) | set(new)) - handled - ANNOTATION_KEYWORDS
    return _changed_keywords(old, new, candidates)


def _check_no_nan_inf(val: Any) -> None:
    """Ensure data contains no NaN or Infinity floats that violate strict JSON."""
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            raise ValueError("NaN and Infinity are not permitted in JSON data")
    elif isinstance(val, dict):
        for v in val.values():
            _check_no_nan_inf(v)
    elif isinstance(val, (list, tuple)):
        for item in val:
            _check_no_nan_inf(item)


def _canonical_json(val: Any) -> str:
    """Serialize a JSON value to a canonical string representation for comparison."""
    if isinstance(val, bool):
        return f"bool:{json.dumps(val)}"
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return f"float:{val}"
    if isinstance(val, (int, float)):
        if val == int(val):
            return f"num:{int(val)}"
        return f"num:{float(val)}"
    return f"{type(val).__name__}:{json.dumps(val, sort_keys=True)}"


def _type_names(schema: Dict[str, Any]) -> Optional[Set[str]]:
    """Extract normalized schema type names as a set of strings, or None if omitted."""
    t = schema.get("type")
    if t is None:
        return None
    if isinstance(t, str):
        return {t}
    if isinstance(t, (list, tuple, set)):
        return set(t)
    return {str(t)}


def load_contract(raw: Any) -> Dict[str, Any]:
    """Parse and validate a raw tool contract dictionary into a normalized schema representation."""
    if not isinstance(raw, dict):
        raise ValueError("schema must be a dictionary")
    _check_no_nan_inf(raw)
    t_set = _type_names(raw)
    if t_set is not None and "object" not in t_set:
        raise ValueError("object type required")
    properties = raw.get("properties")
    if properties is not None:
        if not isinstance(properties, dict):
            raise ValueError("properties must be a dictionary")
        for p_name, p_val in properties.items():
            if not isinstance(p_val, dict):
                raise ValueError(f"property schema for '{p_name}' must be a dictionary")

            if "minimum" in p_val:
                m = p_val["minimum"]
                if not isinstance(m, (int, float)) or isinstance(m, bool) or math.isnan(m) or math.isinf(m):
                    raise ValueError(f"property '{p_name}' minimum must be a numeric value")
            if "maximum" in p_val:
                m = p_val["maximum"]
                if not isinstance(m, (int, float)) or isinstance(m, bool) or math.isnan(m) or math.isinf(m):
                    raise ValueError(f"property '{p_name}' maximum must be a numeric value")
            if "minLength" in p_val:
                ml = p_val["minLength"]
                if not isinstance(ml, int) or isinstance(ml, bool) or ml < 0:
                    raise ValueError(f"property '{p_name}' minLength must be a non-negative integer")
            if "maxLength" in p_val:
                ml = p_val["maxLength"]
                if not isinstance(ml, int) or isinstance(ml, bool) or ml < 0:
                    raise ValueError(f"property '{p_name}' maxLength must be a non-negative integer")
            if "minItems" in p_val:
                mi = p_val["minItems"]
                if not isinstance(mi, int) or isinstance(mi, bool) or mi < 0:
                    raise ValueError(f"property '{p_name}' minItems must be a non-negative integer")
            if "maxItems" in p_val:
                mi = p_val["maxItems"]
                if not isinstance(mi, int) or isinstance(mi, bool) or mi < 0:
                    raise ValueError(f"property '{p_name}' maxItems must be a non-negative integer")
            if "enum" in p_val:
                if not isinstance(p_val["enum"], (list, tuple)):
                    raise ValueError(f"property '{p_name}' enum must be a list")

    required = raw.get("required", [])
    if not isinstance(required, list) or any(not isinstance(r, str) for r in required):
        raise ValueError("required must be a list of strings")

    return {
        "title": raw.get("title", "unnamed_tool"),
        "type": "object",
        "properties": dict(properties or {}),
        "required": list(required),
        "additionalProperties": raw.get("additionalProperties", True),
        "raw": raw,
    }


def load_calls(raw: Any) -> List[Dict[str, Any]]:
    """Parse and validate recorded tool invocation calls into a standardized call list."""
    if not isinstance(raw, list):
        raise ValueError("calls must be a list")
    calls = []
    for item in raw:
        if not isinstance(item, dict) or "arguments" not in item:
            raise ValueError("each call must be an object with arguments dict")
        if not isinstance(item["arguments"], dict):
            raise ValueError("call arguments must be a dictionary")
        _check_no_nan_inf(item["arguments"])
        calls.append(
            {
                "id": str(item.get("id", f"call_{len(calls)+1}")),
                "arguments": dict(item["arguments"]),
            }
        )
    return calls


def validate_call(contract: Dict[str, Any], args: Any) -> Tuple[bool, List[str]]:
    """Validate a dictionary of tool arguments against a parsed contract schema."""
    if not isinstance(args, dict):
        return False, ["arguments must be a dictionary"]
    issues = []
    properties = contract.get("properties", {})
    required = set(contract.get("required", []))
    additional_allowed = contract.get("additionalProperties", True)

    for req in sorted(required):
        if req not in args:
            issues.append(f"missing required property: {req}")

    if not additional_allowed:
        for key in sorted(args):
            if key not in properties:
                issues.append(f"unexpected property: {key}")

    for key, val in sorted(args.items()):
        if key not in properties:
            continue
        p_schema = properties[key]
        expected_types = _type_names(p_schema)

        if val is None:
            if expected_types is not None and "null" not in expected_types:
                issues.append(f"property '{key}' cannot be null")
            if "enum" in p_schema:
                val_canon = _canonical_json(val)
                allowed_canons = {_canonical_json(x) for x in p_schema["enum"]}
                if val_canon not in allowed_canons:
                    issues.append(f"property '{key}' value {val!r} not in enum {p_schema['enum']}")
            continue

        if expected_types is not None:
            matched = False
            for t in sorted(expected_types):
                if t == "string" and isinstance(val, str) and not isinstance(val, bool):
                    matched = True
                    break
                elif (
                    t == "integer"
                    and isinstance(val, (int, float))
                    and not isinstance(val, bool)
                    and val == int(val)
                ):
                    matched = True
                    break
                elif t == "number" and isinstance(val, (int, float)) and not isinstance(val, bool):
                    matched = True
                    break
                elif t == "boolean" and isinstance(val, bool):
                    matched = True
                    break
                elif t == "array" and isinstance(val, list):
                    matched = True
                    break
                elif t == "object" and isinstance(val, dict):
                    matched = True
                    break
                elif t == "null" and val is None:
                    matched = True
                    break
            if not matched:
                issues.append(
                    f"property '{key}' type mismatch (expected one of {sorted(list(expected_types))})"
                )

        if isinstance(val, str) and not isinstance(val, bool):
            if "minLength" in p_schema and len(val) < p_schema["minLength"]:
                issues.append(f"property '{key}' shorter than minLength {p_schema['minLength']}")
            if "maxLength" in p_schema and len(val) > p_schema["maxLength"]:
                issues.append(f"property '{key}' longer than maxLength {p_schema['maxLength']}")
        elif isinstance(val, (int, float)) and not isinstance(val, bool):
            if "minimum" in p_schema and val < p_schema["minimum"]:
                issues.append(f"property '{key}' less than minimum {p_schema['minimum']}")
            if "maximum" in p_schema and val > p_schema["maximum"]:
                issues.append(f"property '{key}' greater than maximum {p_schema['maximum']}")
        elif isinstance(val, list):
            if "minItems" in p_schema and len(val) < p_schema["minItems"]:
                issues.append(f"property '{key}' has fewer items than minItems {p_schema['minItems']}")
            if "maxItems" in p_schema and len(val) > p_schema["maxItems"]:
                issues.append(f"property '{key}' has more items than maxItems {p_schema['maxItems']}")

        if "enum" in p_schema:
            val_canon = _canonical_json(val)
            allowed_canons = {_canonical_json(x) for x in p_schema["enum"]}
            if val_canon not in allowed_canons:
                issues.append(f"property '{key}' value {val!r} not in enum {p_schema['enum']}")

    return (len(issues) == 0, issues)


def classify_changes(old_contract: Dict[str, Any], new_contract: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compare two tool contracts and classify changes as breaking, compatible, or unresolved."""
    changes = []
    old_raw = old_contract.get("raw", {})
    new_raw = new_contract.get("raw", {})

    for kw in _unhandled_keywords(old_raw, new_raw, ROOT_KEYWORDS):
        changes.append(
            {
                "type": "unresolved",
                "category": "unresolved_keyword",
                "property": kw,
                "keyword": kw,
                "description": f"Schema keyword '{kw}' changed and is outside the supported subset.",
            }
        )

    old_props = old_contract.get("properties", {})
    new_props = new_contract.get("properties", {})
    old_req = set(old_contract.get("required", []))
    new_req = set(new_contract.get("required", []))
    new_additional = new_contract.get("additionalProperties", True)

    all_props = sorted(set(old_props.keys()) | set(new_props.keys()))
    for prop in all_props:
        old_p = old_props.get(prop, {})
        new_p = new_props.get(prop, {})
        for kw in _unhandled_keywords(old_p, new_p, PROPERTY_KEYWORDS | NESTED_KEYWORDS):
            changes.append(
                {
                    "type": "unresolved",
                    "category": "unresolved_keyword",
                    "property": prop,
                    "keyword": kw,
                    "description": f"Property '{prop}' keyword '{kw}' changed and is outside the supported subset.",
                }
            )

    for prop in sorted(new_req):
        if prop not in old_req:
            changes.append(
                {
                    "type": "breaking",
                    "category": "added_required",
                    "property": prop,
                    "description": f"Property '{prop}' is newly required in the new contract.",
                }
            )

    for prop in sorted(old_props):
        if prop not in new_props:
            if not new_additional:
                changes.append(
                    {
                        "type": "breaking",
                        "category": "removed_property",
                        "property": prop,
                        "description": f"Property '{prop}' removed and new contract rejects additional properties.",
                    }
                )
            else:
                changes.append(
                    {
                        "type": "compatible",
                        "category": "removed_permitted_property",
                        "property": prop,
                        "description": f"Property '{prop}' removed from explicit schema but permitted as additional property.",
                    }
                )

    for prop in sorted(new_props):
        if prop not in old_props:
            if prop not in new_req:
                changes.append(
                    {
                        "type": "compatible",
                        "category": "added_optional",
                        "property": prop,
                        "description": f"Optional property '{prop}' added.",
                    }
                )

    old_add = old_contract.get("additionalProperties", True)
    if old_add and not new_additional:
        changes.append(
            {
                "type": "breaking",
                "category": "closed_schema",
                "property": "additionalProperties",
                "description": "additionalProperties changed from allowed to rejected.",
            }
        )
    elif not old_add and new_additional:
        changes.append(
            {
                "type": "compatible",
                "category": "opened_schema",
                "property": "additionalProperties",
                "description": "additionalProperties now permitted.",
            }
        )

    for prop in all_props:
        nested = _changed_keywords(
            _nested_view(old_props.get(prop, {})), _nested_view(new_props.get(prop, {})), NESTED_KEYWORDS
        )
        if nested:
            changes.append(
                {
                    "type": "unresolved",
                    "category": "nested_restriction",
                    "property": prop,
                    "keywords": nested,
                    "description": f"Property '{prop}' nested schema keywords {nested} changed; nested schemas are outside the supported flat subset.",
                }
            )

    for prop in sorted(old_props.keys()):
        if prop not in new_props:
            continue
        old_p = old_props[prop]
        new_p = new_props[prop]

        old_types = _type_names(old_p)
        new_types = _type_names(new_p)

        if old_types is None and new_types is not None:
            changes.append(
                {
                    "type": "breaking",
                    "category": "type_narrowed",
                    "property": prop,
                    "description": f"Property '{prop}' newly constrained to types: {sorted(list(new_types))}.",
                }
            )
        elif old_types is not None and new_types is None:
            changes.append(
                {
                    "type": "compatible",
                    "category": "type_widened",
                    "property": prop,
                    "description": f"Property '{prop}' type restriction removed.",
                }
            )
        elif old_types is not None and new_types is not None and old_types != new_types:
            effective_new = set(new_types)
            if "number" in effective_new:
                effective_new.add("integer")
            effective_old = set(old_types)
            if "number" in effective_old:
                effective_old.add("integer")

            removed_types = set(t for t in old_types if t not in effective_new)
            added_types = set(t for t in new_types if t not in effective_old)

            if removed_types:
                changes.append(
                    {
                        "type": "breaking",
                        "category": "type_narrowed",
                        "property": prop,
                        "description": f"Property '{prop}' types narrowed; removed types: {sorted(list(removed_types))}.",
                    }
                )
            elif added_types:
                changes.append(
                    {
                        "type": "compatible",
                        "category": "type_widened",
                        "property": prop,
                        "description": f"Property '{prop}' types widened; added types: {sorted(list(added_types))}.",
                    }
                )

        if "enum" in old_p:
            old_enum_map = {_canonical_json(v): v for v in old_p["enum"]}
            if "enum" in new_p:
                new_enum_map = {_canonical_json(v): v for v in new_p["enum"]}
                removed_keys = sorted(set(old_enum_map.keys()) - set(new_enum_map.keys()))
                added_keys = sorted(set(new_enum_map.keys()) - set(old_enum_map.keys()))
                if removed_keys:
                    removed_vals = [old_enum_map[k] for k in removed_keys]
                    changes.append(
                        {
                            "type": "breaking",
                            "category": "enum_narrowed",
                            "property": prop,
                            "description": f"Property '{prop}' enum narrowed; removed allowed values: {removed_vals}.",
                        }
                    )
                if added_keys:
                    added_vals = [new_enum_map[k] for k in added_keys]
                    changes.append(
                        {
                            "type": "compatible",
                            "category": "enum_widened",
                            "property": prop,
                            "description": f"Property '{prop}' enum widened; added values: {added_vals}.",
                        }
                    )
            else:
                changes.append(
                    {
                        "type": "compatible",
                        "category": "enum_removed",
                        "property": prop,
                        "description": f"Property '{prop}' enum restriction removed.",
                    }
                )
        elif "enum" in new_p:
            changes.append(
                {
                    "type": "breaking",
                    "category": "enum_introduced",
                    "property": prop,
                    "description": f"Property '{prop}' newly constrained by enum {new_p['enum']}.",
                }
            )

        for bound, is_min in [("minimum", True), ("minLength", True), ("minItems", True)]:
            if bound in new_p:
                old_val = old_p.get(bound)
                new_val = new_p[bound]
                if old_val is None or new_val > old_val:
                    changes.append(
                        {
                            "type": "breaking",
                            "category": "bound_narrowed",
                            "property": prop,
                            "bound": bound,
                            "description": f"Property '{prop}' {bound} tightened from {old_val} to {new_val}.",
                        }
                    )
                elif new_val < old_val:
                    changes.append(
                        {
                            "type": "compatible",
                            "category": "bound_relaxed",
                            "property": prop,
                            "bound": bound,
                            "description": f"Property '{prop}' {bound} relaxed from {old_val} to {new_val}.",
                        }
                    )

        for bound in ["maximum", "maxLength", "maxItems"]:
            if bound in new_p:
                old_val = old_p.get(bound)
                new_val = new_p[bound]
                if old_val is None or new_val < old_val:
                    changes.append(
                        {
                            "type": "breaking",
                            "category": "bound_narrowed",
                            "property": prop,
                            "bound": bound,
                            "description": f"Property '{prop}' {bound} tightened from {old_val} to {new_val}.",
                        }
                    )
                elif new_val > old_val:
                    changes.append(
                        {
                            "type": "compatible",
                            "category": "bound_relaxed",
                            "property": prop,
                            "bound": bound,
                            "description": f"Property '{prop}' {bound} relaxed from {old_val} to {new_val}.",
                        }
                    )

    return changes


def _synthesize_base_payload(contract: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a minimal valid baseline argument payload that satisfies the given contract."""
    payload = {}
    props = contract.get("properties", {})
    required = contract.get("required", [])

    for key in sorted(required):
        if key in props:
            p_schema = props[key]
            p_types = _type_names(p_schema) or {"string"}
            if "enum" in p_schema and p_schema["enum"]:
                payload[key] = p_schema["enum"][0]
            elif "string" in p_types:
                min_len = p_schema.get("minLength", 1)
                payload[key] = "a" * max(1, min_len)
            elif "integer" in p_types or "number" in p_types:
                val = p_schema.get("minimum", 1)
                payload[key] = val
            elif "boolean" in p_types:
                payload[key] = True
            elif "array" in p_types:
                min_items = p_schema.get("minItems", 0)
                payload[key] = ["item"] * min_items
            elif "object" in p_types:
                payload[key] = {}
            elif "null" in p_types:
                payload[key] = None
            else:
                payload[key] = "sample"
        else:
            payload[key] = "sample"
    return payload


def generate_counterexamples(
    old_contract: Dict[str, Any], new_contract: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Synthesize concrete failing call fixtures that pass the old contract but fail the new contract."""
    changes = classify_changes(old_contract, new_contract)
    breaking_changes = [c for c in changes if c["type"] == "breaking"]
    counterexamples = []
    old_props = old_contract.get("properties", {})
    new_props = new_contract.get("properties", {})

    for ch in breaking_changes:
        cat = ch["category"]
        prop = ch["property"]
        base = _synthesize_base_payload(old_contract)

        if cat == "added_required":
            payload = dict(base)
            payload.pop(prop, None)
            valid_old, _ = validate_call(old_contract, payload)
            valid_new, _ = validate_call(new_contract, payload)
            if valid_old and not valid_new:
                counterexamples.append(
                    {
                        "breaking_category": cat,
                        "property": prop,
                        "payload": payload,
                        "reason": f"Omitted newly-required property '{prop}' which old callers did not supply.",
                    }
                )
        elif cat == "enum_narrowed":
            old_enum = old_props.get(prop, {}).get("enum", [])
            new_enum_canons = {_canonical_json(v) for v in new_props.get(prop, {}).get("enum", [])}
            removed = [v for v in old_enum if _canonical_json(v) not in new_enum_canons]
            if removed:
                payload = dict(base)
                payload[prop] = removed[0]
                valid_old, _ = validate_call(old_contract, payload)
                valid_new, _ = validate_call(new_contract, payload)
                if valid_old and not valid_new:
                    counterexamples.append(
                        {
                            "breaking_category": cat,
                            "property": prop,
                            "payload": payload,
                            "reason": f"Uses removed enum value {removed[0]!r} on property '{prop}'.",
                        }
                    )
        elif cat == "enum_introduced":
            new_enum = new_props.get(prop, {}).get("enum", [])
            new_enum_canons = {_canonical_json(v) for v in new_enum}
            test_val = "__unconstrained_val__"
            if _canonical_json(test_val) not in new_enum_canons:
                payload = dict(base)
                payload[prop] = test_val
                valid_old, _ = validate_call(old_contract, payload)
                valid_new, _ = validate_call(new_contract, payload)
                if valid_old and not valid_new:
                    counterexamples.append(
                        {
                            "breaking_category": cat,
                            "property": prop,
                            "payload": payload,
                            "reason": f"Property '{prop}' value {test_val!r} not in newly introduced enum.",
                        }
                    )
        elif cat == "type_narrowed":
            new_types = _type_names(new_props.get(prop, {})) or set()
            old_types = _type_names(old_props.get(prop, {}))
            samples = {
                "string": "text",
                "integer": 42,
                "number": 1.5,
                "boolean": True,
                "array": ["item"],
                "object": {"item": 1},
                "null": None,
            }
            old_p = old_props.get(prop, {})
            if old_types is None:
                tried_types = list(samples)
            else:
                effective_new = set(new_types)
                if "number" in effective_new:
                    effective_new.add("integer")
                tried_types = sorted(old_types - effective_new)
            candidates = []
            for t in tried_types:
                shaped = dict(old_p, type=t)
                candidates.append(_synthesize_base_payload({"properties": {prop: shaped}, "required": [prop]})[prop])
                candidates.append(samples.get(t, "val"))
            for candidate in candidates:
                payload = dict(base)
                payload[prop] = candidate
                valid_old, _ = validate_call(old_contract, payload)
                valid_new, _ = validate_call(new_contract, payload)
                if valid_old and not valid_new:
                    counterexamples.append(
                        {
                            "breaking_category": cat,
                            "property": prop,
                            "payload": payload,
                            "reason": f"Property '{prop}' value {candidate!r} violates narrowed types {sorted(list(new_types))}.",
                        }
                    )
                    break
        elif cat == "bound_narrowed":
            bound = ch.get("bound")
            new_p = new_props.get(prop, {})
            old_p = old_props.get(prop, {})

            if bound == "maximum" and "maximum" in new_p:
                val = new_p["maximum"] + 1
                if "maximum" not in old_p or val <= old_p["maximum"]:
                    payload = dict(base)
                    payload[prop] = val
                    valid_old, _ = validate_call(old_contract, payload)
                    valid_new, _ = validate_call(new_contract, payload)
                    if valid_old and not valid_new:
                        counterexamples.append(
                            {
                                "breaking_category": cat,
                                "property": prop,
                                "payload": payload,
                                "reason": f"Property '{prop}' exceeds new maximum {new_p['maximum']}.",
                            }
                        )
            elif bound == "minimum" and "minimum" in new_p:
                val = new_p["minimum"] - 1
                if "minimum" not in old_p or val >= old_p["minimum"]:
                    payload = dict(base)
                    payload[prop] = val
                    valid_old, _ = validate_call(old_contract, payload)
                    valid_new, _ = validate_call(new_contract, payload)
                    if valid_old and not valid_new:
                        counterexamples.append(
                            {
                                "breaking_category": cat,
                                "property": prop,
                                "payload": payload,
                                "reason": f"Property '{prop}' is below new minimum {new_p['minimum']}.",
                            }
                        )
            elif bound == "maxLength" and "maxLength" in new_p:
                val = "x" * (new_p["maxLength"] + 1)
                if "maxLength" not in old_p or len(val) <= old_p["maxLength"]:
                    payload = dict(base)
                    payload[prop] = val
                    valid_old, _ = validate_call(old_contract, payload)
                    valid_new, _ = validate_call(new_contract, payload)
                    if valid_old and not valid_new:
                        counterexamples.append(
                            {
                                "breaking_category": cat,
                                "property": prop,
                                "payload": payload,
                                "reason": f"Property '{prop}' length exceeds new maxLength {new_p['maxLength']}.",
                            }
                        )
            elif bound == "minLength" and "minLength" in new_p:
                val = "x" * max(0, new_p["minLength"] - 1)
                if "minLength" not in old_p or len(val) >= old_p["minLength"]:
                    payload = dict(base)
                    payload[prop] = val
                    valid_old, _ = validate_call(old_contract, payload)
                    valid_new, _ = validate_call(new_contract, payload)
                    if valid_old and not valid_new:
                        counterexamples.append(
                            {
                                "breaking_category": cat,
                                "property": prop,
                                "payload": payload,
                                "reason": f"Property '{prop}' length is below new minLength {new_p['minLength']}.",
                            }
                        )
            elif bound == "minItems" and "minItems" in new_p:
                val = ["x"] * max(0, new_p["minItems"] - 1)
                payload = dict(base)
                payload[prop] = val
                valid_old, _ = validate_call(old_contract, payload)
                valid_new, _ = validate_call(new_contract, payload)
                if valid_old and not valid_new:
                    counterexamples.append(
                        {
                            "breaking_category": cat,
                            "property": prop,
                            "payload": payload,
                            "reason": f"Property '{prop}' array length is below new minItems {new_p['minItems']}.",
                        }
                    )
            elif bound == "maxItems" and "maxItems" in new_p:
                val = ["x"] * (new_p["maxItems"] + 1)
                payload = dict(base)
                payload[prop] = val
                valid_old, _ = validate_call(old_contract, payload)
                valid_new, _ = validate_call(new_contract, payload)
                if valid_old and not valid_new:
                    counterexamples.append(
                        {
                            "breaking_category": cat,
                            "property": prop,
                            "payload": payload,
                            "reason": f"Property '{prop}' array length exceeds new maxItems {new_p['maxItems']}.",
                        }
                    )
        elif cat == "closed_schema":
            payload = dict(base)
            payload["_unrecognized_extra_key"] = "test"
            valid_old, _ = validate_call(old_contract, payload)
            valid_new, _ = validate_call(new_contract, payload)
            if valid_old and not valid_new:
                counterexamples.append(
                    {
                        "breaking_category": cat,
                        "property": "additionalProperties",
                        "payload": payload,
                        "reason": "Contains extra property rejected by new closed schema.",
                    }
                )
        elif cat == "removed_property":
            old_p = old_props.get(prop, {})
            schema_value = _synthesize_base_payload({"properties": {prop: old_p}, "required": [prop]})[prop]
            for candidate in [schema_value, "removed_property_val", 123, True, [], {}]:
                payload = dict(base)
                payload[prop] = candidate
                valid_old, _ = validate_call(old_contract, payload)
                valid_new, _ = validate_call(new_contract, payload)
                if valid_old and not valid_new:
                    counterexamples.append(
                        {
                            "breaking_category": cat,
                            "property": prop,
                            "payload": payload,
                            "reason": f"Supplies removed property '{prop}' to a contract that now rejects it.",
                        }
                    )
                    break

    return counterexamples


def replay_calls(
    old_contract: Dict[str, Any],
    new_contract: Dict[str, Any],
    calls: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Replay saved tool calls against both contracts and partition into preserved, broken, and invalid."""
    preserved = []
    broken = []
    already_invalid = []

    for call in calls:
        cid = call["id"]
        args = call["arguments"]
        valid_old, old_errs = validate_call(old_contract, args)
        valid_new, new_errs = validate_call(new_contract, args)

        if not valid_old:
            already_invalid.append({"id": cid, "arguments": args, "reasons": old_errs})
        elif valid_new:
            preserved.append({"id": cid, "arguments": args})
        else:
            broken.append({"id": cid, "arguments": args, "breaking_reasons": new_errs})

    denominator = len(preserved) + len(broken)
    rate = len(broken) / denominator if denominator > 0 else 0.0

    return {
        "total": len(calls),
        "preserved": preserved,
        "broken": broken,
        "already_invalid": already_invalid,
        "breaking_rate": round(rate, 4),
    }


def build_report(
    old_contract: Dict[str, Any],
    new_contract: Dict[str, Any],
    changes: List[Dict[str, Any]],
    counterexamples: List[Dict[str, Any]],
    replay_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Assemble a comprehensive migration report combining static analysis, counterexamples, and replay."""
    breaking = [c for c in changes if c["type"] == "breaking"]
    compatible = [c for c in changes if c["type"] == "compatible"]
    unresolved = [c for c in changes if c["type"] == "unresolved"]

    is_compatible = (
        len(breaking) == 0
        and len(unresolved) == 0
        and len(replay_result.get("broken", [])) == 0
    )

    if is_compatible:
        summary = "Contract update is fully backwards-compatible. All historical calls preserved."
    else:
        reasons = []
        if breaking:
            reasons.append(f"{len(breaking)} breaking changes")
        if unresolved:
            reasons.append(f"{len(unresolved)} unresolved schema keywords")
        if replay_result.get("broken"):
            reasons.append(f"{len(replay_result['broken'])} broken historical calls")
        summary = f"Contract update is incompatible: {', '.join(reasons)}."

    return {
        "schema_version": 1,
        "tool_name": old_contract.get("title", "unnamed_tool"),
        "compatible": is_compatible,
        "breaking_count": len(breaking),
        "compatible_count": len(compatible),
        "unresolved_count": len(unresolved),
        "changes": changes,
        "counterexamples": counterexamples,
        "replay": replay_result,
        "summary": summary,
    }


def export_fixtures(
    output_path: str,
    counterexamples: List[Dict[str, Any]],
    broken_calls: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Export synthesized counterexamples and broken calls to a JSON test fixture file."""
    fixture_data = {
        "version": 1,
        "description": "Generated migration fixtures for CI regression checks",
        "synthesized_counterexamples": counterexamples,
        "broken_historical_calls": broken_calls,
    }
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(fixture_data, f, indent=2)
    return fixture_data
