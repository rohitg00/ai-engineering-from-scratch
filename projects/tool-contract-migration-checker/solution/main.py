"""Tool Contract Migration Checker - Core Implementation."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

SUPPORTED_KEYWORDS = {
    "$schema",
    "title",
    "description",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "enum",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
}

UNRESOLVED_KEYWORDS = {
    "$ref",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "patternProperties",
    "dependentRequired",
    "prefixItems",
}


def _canonical_json(val: Any) -> str:
    """Serialize a JSON value to a canonical string representation for comparison."""
    if isinstance(val, bool):
        return f"bool:{json.dumps(val)}"
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

    for req in required:
        if req not in args:
            issues.append(f"missing required property: {req}")

    if not additional_allowed:
        for key in args:
            if key not in properties:
                issues.append(f"unexpected property: {key}")

    for key, val in args.items():
        if key not in properties:
            continue
        p_schema = properties[key]
        expected_types = _type_names(p_schema)

        if val is None:
            if expected_types is not None and "null" not in expected_types:
                issues.append(f"property '{key}' cannot be null")
            continue

        if expected_types is not None:
            matched = False
            for t in expected_types:
                if t == "string" and isinstance(val, str) and not isinstance(val, bool):
                    matched = True
                    break
                elif t == "integer" and isinstance(val, int) and not isinstance(val, bool):
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

    for kw in UNRESOLVED_KEYWORDS:
        if kw in old_raw or kw in new_raw:
            changes.append(
                {
                    "type": "unresolved",
                    "category": "unresolved_keyword",
                    "property": kw,
                    "description": f"Schema contains unhandled keyword '{kw}'.",
                }
            )

    old_props = old_contract.get("properties", {})
    new_props = new_contract.get("properties", {})
    old_req = set(old_contract.get("required", []))
    new_req = set(new_contract.get("required", []))
    new_additional = new_contract.get("additionalProperties", True)

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

    all_props = sorted(set(old_props.keys()) | set(new_props.keys()))
    for prop in all_props:
        old_p = old_props.get(prop, {})
        new_p = new_props.get(prop, {})
        if "properties" in new_p or "properties" in old_p or "items" in new_p or "items" in old_p:
            changes.append(
                {
                    "type": "unresolved",
                    "category": "nested_restriction",
                    "property": prop,
                    "description": f"Property '{prop}' contains nested schema definitions outside the supported flat subset.",
                }
            )

    for prop, old_p in sorted(old_props.items()):
        if prop not in new_props:
            continue
        new_p = new_props[prop]

        old_types = _type_names(old_p)
        new_types = _type_names(new_p)
        if old_types is not None and new_types is not None and old_types != new_types:
            removed_types = old_types - new_types
            added_types = new_types - old_types
            if old_types == {"integer"} and new_types == {"number"}:
                changes.append(
                    {
                        "type": "compatible",
                        "category": "type_widened",
                        "property": prop,
                        "description": f"Property '{prop}' type widened from integer to number.",
                    }
                )
            elif removed_types:
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

    for key in required:
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
            old_types = _type_names(old_props.get(prop, {})) or set()
            test_val = None
            if "number" in old_types and "integer" in new_types and "number" not in new_types:
                test_val = 1.5
            elif "string" not in new_types and "string" in old_types:
                test_val = "text"
            elif "integer" not in new_types and "integer" in old_types:
                test_val = 42
            if test_val is not None:
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
                            "reason": f"Property '{prop}' value {test_val!r} violates narrowed types {sorted(list(new_types))}.",
                        }
                    )
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
            old_types = _type_names(old_p) or {"string"}
            payload = dict(base)
            payload[prop] = "test_val" if "string" in old_types else 1
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
