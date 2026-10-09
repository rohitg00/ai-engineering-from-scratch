import html
import json
import math


def validate_contract(contract):
    if not isinstance(contract, dict) or set(contract) - {
        "version",
        "fields",
        "unique",
        "min_rows",
        "max_rows",
        "allow_extra",
    }:
        raise ValueError("unknown contract keys")
    if type(contract.get("version")) is not int or contract["version"] != 1:
        raise ValueError("contract version must be 1")
    fields = contract.get("fields")
    if not isinstance(fields, dict) or not fields:
        raise ValueError("fields must be a nonempty object")
    for name, spec in fields.items():
        if not isinstance(name, str) or not name or not isinstance(spec, dict):
            raise ValueError("invalid field declaration")
        if set(spec) - {"type", "required", "min", "max", "enum"}:
            raise ValueError("unknown field rules")
        if spec.get("type") not in {"string", "integer", "number", "boolean"}:
            raise ValueError("unknown field type")
        if "required" in spec and type(spec["required"]) is not bool:
            raise ValueError("required must be Boolean")
        for bound in ("min", "max"):
            if bound in spec and (
                spec["type"] not in {"integer", "number"}
                or not matches_type(spec[bound], "number")
            ):
                raise ValueError(
                    "bounds require finite numeric values and a numeric field"
                )
        if "min" in spec and "max" in spec and spec["min"] > spec["max"]:
            raise ValueError("minimum exceeds maximum")
        if "enum" in spec:
            if (
                not isinstance(spec["enum"], list)
                or not spec["enum"]
                or any(not matches_type(v, spec["type"]) for v in spec["enum"])
            ):
                raise ValueError("enum must be a nonempty list of the declared type")
    unique = contract.get("unique", [])
    if (
        not isinstance(unique, list)
        or any(not isinstance(key, str) or key not in fields for key in unique)
        or len(unique) != len(set(unique))
    ):
        raise ValueError("unique must list distinct declared fields")
    for key in ("min_rows", "max_rows"):
        if key in contract and (type(contract[key]) is not int or contract[key] < 0):
            raise ValueError("row bounds must be nonnegative integers")
    if contract.get("min_rows", 0) > contract.get("max_rows", math.inf):
        raise ValueError("minimum row count exceeds maximum")
    if "allow_extra" in contract and type(contract["allow_extra"]) is not bool:
        raise ValueError("allow_extra must be Boolean")
    return contract


def matches_type(value, kind):
    if kind == "string":
        return isinstance(value, str)
    if kind == "integer":
        return type(value) is int
    if kind == "number":
        return type(value) is int or (type(value) is float and math.isfinite(value))
    return type(value) is bool


def row_issues(row, contract):
    if not isinstance(row, dict):
        return [{"field": "", "rule": "object"}]
    issues = []
    for name, spec in contract["fields"].items():
        if name not in row:
            if spec.get("required", False):
                issues.append({"field": name, "rule": "required"})
            continue
        value = row[name]
        if not matches_type(value, spec["type"]):
            issues.append({"field": name, "rule": "type"})
            continue
        for bound, violates in (
            ("min", lambda value, threshold: value < threshold),
            ("max", lambda value, threshold: value > threshold),
        ):
            if bound in spec and violates(value, spec[bound]):
                issues.append({"field": name, "rule": bound})
        if "enum" in spec and value not in spec["enum"]:
            issues.append({"field": name, "rule": "enum"})
    if not contract.get("allow_extra", False):
        issues.extend(
            {"field": key, "rule": "extra"}
            for key in sorted(set(row) - set(contract["fields"]))
        )
    return issues


def duplicate_rows(rows, contract):
    duplicates = []
    for name in contract.get("unique", []):
        groups = {}
        for number, row in enumerate(rows, 1):
            if (
                isinstance(row, dict)
                and name in row
                and matches_type(row[name], contract["fields"][name]["type"])
            ):
                value = row[name]
                groups.setdefault(value, []).append(number)
        duplicates.extend(
            {"field": name, "rows": numbers}
            for numbers in groups.values()
            if len(numbers) > 1
        )
    return duplicates


def evaluate(rows, contract):
    validate_contract(contract)
    if not isinstance(rows, list) or len(rows) > 100000:
        raise ValueError("rows must contain at most 100000 records")
    issues = {number: row_issues(row, contract) for number, row in enumerate(rows, 1)}
    duplicates = duplicate_rows(rows, contract)
    for group in duplicates:
        for number in group["rows"]:
            issues[number].append({"field": group["field"], "rule": "unique"})
    dataset_issues = []
    if len(rows) < contract.get("min_rows", 0):
        dataset_issues.append("min_rows")
    if len(rows) > contract.get("max_rows", math.inf):
        dataset_issues.append("max_rows")
    accepted, quarantine = [], []
    for number, row in enumerate(rows, 1):
        if issues[number]:
            quarantine.append(
                {"row_number": number, "record": row, "issues": issues[number]}
            )
        else:
            accepted.append(row)
    return {
        "schema_version": 1,
        "passed": not quarantine and not dataset_issues,
        "counts": {
            "input": len(rows),
            "accepted": len(accepted),
            "quarantined": len(quarantine),
        },
        "dataset_issues": dataset_issues,
        "duplicates": duplicates,
        "accepted": accepted,
        "quarantine": quarantine,
    }


def render_html(report):
    rows = "".join(
        f"<tr><td>{row['row_number']}</td><td>{html.escape(json.dumps(row['issues']))}</td></tr>"
        for row in report["quarantine"]
    )
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dataset contract gate</title>
<style>:root{{color-scheme:light dark}}body{{font:17px system-ui;max-width:900px;margin:32px auto;padding:0 18px;line-height:1.6}}table{{width:100%;border-collapse:collapse}}td,th{{padding:12px;border-bottom:1px solid #888;text-align:left;overflow-wrap:anywhere}}pre{{white-space:pre-wrap}}h1{{line-height:1.2}}</style>
<h1>Dataset contract gate</h1><p id="decision">Gate: {"PASS" if report["passed"] else "FAIL"}</p><p>{report["counts"]["accepted"]} accepted; {report["counts"]["quarantined"]} quarantined.</p><p>Dataset checks: {html.escape(", ".join(report["dataset_issues"]) or "pass")}</p>
<table><thead><tr><th>Source line</th><th>Reasons</th></tr></thead><tbody>{rows}</tbody></table><details><summary>Inspect duplicate groups</summary><pre>{html.escape(json.dumps(report["duplicates"], indent=2))}</pre></details>
<p>All members of a duplicate group are quarantined. Clean rows remain exportable even when a whole-dataset row-count rule fails; consult receipt.json before ingestion.</p></html>"""
