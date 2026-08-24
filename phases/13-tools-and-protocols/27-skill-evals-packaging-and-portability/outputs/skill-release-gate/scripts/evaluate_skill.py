#!/usr/bin/env python3
"""Run a deterministic, read-only JSON release gate for this skill bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path, PurePosixPath


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CORE_FIELDS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}
MAX_SKILL_BODY_CHARS = 10_000
MAX_COMPANION_FILE_BYTES = 1_000_000
RESERVED_MANIFEST_PATH = "assets/manifest.json"
SUPPORTED_ARTIFACT_MODES = frozenset({"fixture", "captured-artifacts"})
SUPPORTED_EVIDENCE_MODES = frozenset(
    {"deterministic-fixture", "captured-results"}
)
SUPPORTED_HOST_MODES = frozenset(
    {"deterministic-fixture", "captured-capabilities"}
)
ALLOWED_SUFFIXES = {
    "references": frozenset({".md", ".txt", ".json", ".yaml", ".yml"}),
    "scripts": frozenset({".py", ".sh", ".js", ".mjs", ".ts"}),
    "assets": frozenset(
        {
            ".csv",
            ".gif",
            ".jpeg",
            ".jpg",
            ".json",
            ".md",
            ".pdf",
            ".png",
            ".svg",
            ".toml",
            ".txt",
            ".webp",
            ".yaml",
            ".yml",
        }
    ),
    "evals": frozenset({".json"}),
}
SECRET_PATTERNS = (
    re.compile(
        rb"(?i)\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*[\"']?[A-Za-z0-9_./+=-]{12,}"
    ),
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)
SHA256_PATTERN = re.compile(r"sha256:[0-9a-f]{64}")
ATTESTATION_VERSION = 1
REQUIRED_ENTRY_FILES = (
    "SKILL.md",
    "assets/hosts.json",
    "assets/manifest.json",
    "evals/artifacts.json",
    "evals/cases.json",
    "evals/evidence.json",
)


def paths_from_body(body: str) -> set[str]:
    paths: set[str] = set()
    for span in re.findall(r"`([^`]+)`", body):
        for raw_token in span.split():
            token = raw_token.strip("()[]{}<>,;:'\"").rstrip(".,;:")
            if any(
                marker in token
                for marker in ("references/", "scripts/", "assets/", "evals/")
            ):
                paths.add(token)
    return paths


def preflight_bundle(bundle: Path) -> None:
    if bundle.is_symlink() or not bundle.is_dir():
        raise ValueError("regular non-symlink bundle directory is required")
    for path in bundle.rglob("*"):
        relative = path.relative_to(bundle).as_posix()
        if path.is_symlink():
            raise ValueError(f"preflight rejects symlink: {relative}")
        if not path.is_file() and not path.is_dir():
            raise ValueError(f"preflight rejects special file: {relative}")
    for relative in REQUIRED_ENTRY_FILES:
        path = bundle / PurePosixPath(relative)
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"preflight requires regular file: {relative}")


def section_has_content(body: str, title: str) -> bool:
    lines = body.splitlines()
    heading = re.compile(rf"^##\s+{re.escape(title)}\s*#*\s*$", re.IGNORECASE)
    for index, line in enumerate(lines):
        if not heading.fullmatch(line):
            continue
        for candidate in lines[index + 1 :]:
            if re.match(r"^#{1,6}\s+", candidate):
                return False
            if candidate.strip():
                return True
        return False
    return False


def contains_obvious_secret(data: bytes) -> bool:
    return any(pattern.search(data) is not None for pattern in SECRET_PATTERNS)


def digest_text(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def digest_bytes(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def canonical_digest(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return digest_bytes(encoded)


def digest_evidence(config: dict[str, object]) -> str:
    payload = {
        "scriptChecks": config.get("scriptChecks"),
        "safetyChecks": config.get("safetyChecks"),
    }
    return canonical_digest(payload)


def digest_hosts(config: dict[str, object]) -> str:
    payload = {
        "requirements": config.get("requirements"),
        "minimumNativeHosts": config.get("minimumNativeHosts"),
        "hosts": config.get("hosts"),
    }
    return canonical_digest(payload)


def digest_trigger_observations(config: dict[str, object]) -> str:
    payload = {
        "triggerTerms": config.get("triggerTerms"),
        "threshold": config.get("threshold"),
        "runs": config.get("runs"),
        "cases": config.get("cases"),
    }
    return canonical_digest(payload)


def local_evidence_root(
    case_config: dict[str, object],
    artifact_config: dict[str, object],
    evidence_config: dict[str, object],
    host_config: dict[str, object],
    manifest_config: dict[str, object],
) -> str:
    return canonical_digest(
        {
            "cases": case_config,
            "artifacts": artifact_config,
            "evidence": evidence_config,
            "hosts": host_config,
            "manifest": manifest_config,
        }
    )


def verify_external_attestation(
    bundle: Path,
    evidence_root: str,
    attestation_path: Path | None,
    trusted_attestation_digest: str | None,
) -> dict[str, object]:
    issues: list[str] = []
    if attestation_path is None:
        issues.append("trusted external attestation was not supplied")
    if trusted_attestation_digest is None:
        issues.append("trusted attestation SHA-256 was not supplied out of band")
    if issues:
        return {
            "trustAnchorValid": False,
            "issues": issues,
            "attestationDigest": None,
        }

    assert attestation_path is not None
    assert trusted_attestation_digest is not None
    candidate = attestation_path.absolute()
    if candidate.is_symlink() or not candidate.is_file():
        issues.append("external attestation must be a regular non-symlink file")
    else:
        try:
            candidate.resolve(strict=True).relative_to(bundle.resolve(strict=True))
        except ValueError:
            pass
        else:
            issues.append("external attestation must be outside the bundle")
    if not SHA256_PATTERN.fullmatch(trusted_attestation_digest):
        issues.append("trusted attestation SHA-256 has an invalid format")
    if issues:
        return {
            "trustAnchorValid": False,
            "issues": issues,
            "attestationDigest": None,
        }

    payload = candidate.read_bytes()
    actual_digest = digest_bytes(payload)
    if actual_digest != trusted_attestation_digest:
        issues.append("external attestation does not match the trusted SHA-256")
    try:
        decoded = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        issues.append("external attestation must be a UTF-8 JSON object")
        decoded = None
    if decoded is not None:
        if not isinstance(decoded, dict):
            issues.append("external attestation root must be an object")
        else:
            if (
                type(decoded.get("attestationVersion")) is not int
                or decoded.get("attestationVersion") != ATTESTATION_VERSION
            ):
                issues.append(
                    "attestationVersion must be the supported integer value 1"
                )
            if decoded.get("evidenceRoot") != evidence_root:
                issues.append("external attestation evidenceRoot does not match")
    return {
        "trustAnchorValid": not issues,
        "issues": issues,
        "attestationDigest": actual_digest,
    }


def read_json_object(path: Path, label: str) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} root must be an object")
    return value


def lint(
    bundle: Path, allowed_runtime_extensions: tuple[str, ...] | list[str] = ()
) -> dict[str, object]:
    issues: list[str] = []
    if not bundle.is_dir() or bundle.is_symlink():
        return {"passed": False, "issues": ["regular non-symlink bundle directory is required"]}
    skill_path = bundle / "SKILL.md"
    if not skill_path.is_file() or skill_path.is_symlink():
        return {"passed": False, "issues": ["regular SKILL.md is required"]}
    lines = skill_path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        return {"passed": False, "issues": ["frontmatter delimiters are invalid"]}
    end = lines.index("---", 1)
    fields = {}
    index = 1
    while index < end:
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            index += 1
            continue
        if line[:1].isspace() or ":" not in line:
            issues.append(f"malformed top-level line: {index + 1}")
            index += 1
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", key):
            issues.append(f"invalid frontmatter field: {key!r}")
            index += 1
            continue
        if key in fields:
            issues.append(f"duplicate frontmatter field: {key}")
        value = value.strip()
        if key == "metadata" and not value:
            nested: dict[str, str] = {}
            index += 1
            while index < end and (not lines[index] or lines[index][:1].isspace()):
                nested_line = lines[index].strip()
                if nested_line:
                    if ":" not in nested_line:
                        issues.append(f"malformed metadata line: {index + 1}")
                    else:
                        nested_key, nested_value = nested_line.split(":", 1)
                        nested_key = nested_key.strip()
                        if (
                            not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", nested_key)
                            or nested_key in nested
                        ):
                            issues.append(f"invalid metadata field: {nested_key!r}")
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
    name = fields.get("name", "")
    description = fields.get("description", "")
    if not name or len(name) > 64 or not NAME_PATTERN.fullmatch(name):
        issues.append("name must be kebab-case and at most 64 characters")
    if name != bundle.name:
        issues.append("frontmatter name must match bundle directory")
    if not description:
        issues.append("description is required")
    elif len(description) > 1024:
        issues.append("description must be at most 1024 characters")
    body = "\n".join(lines[end + 1 :])
    if not body.strip():
        issues.append("instruction body is required")
    elif len(body.strip()) > MAX_SKILL_BODY_CHARS:
        issues.append(
            f"instruction body exceeds {MAX_SKILL_BODY_CHARS} characters"
        )
    if not section_has_content(body, "Output contract"):
        issues.append("a non-empty ## Output contract section is required")
    if not section_has_content(body, "Failure behavior"):
        issues.append("a non-empty ## Failure behavior section is required")
    allowed_extensions = set(allowed_runtime_extensions)
    for field in sorted(set(fields) - CORE_FIELDS):
        if field not in allowed_extensions:
            issues.append(f"runtime field {field!r} is not explicitly allowed")
    references = paths_from_body(body)
    for reference in sorted(references):
        relative = PurePosixPath(reference)
        if (
            "\\" in reference
            or relative.is_absolute()
            or any(part in {"", ".", ".."} for part in relative.parts)
            or len(relative.parts) != 2
            or relative.parts[0] not in {"references", "scripts", "assets", "evals"}
        ):
            issues.append(f"invalid direct reference: {reference}")
            continue
        path = bundle / relative
        parent = bundle / relative.parts[0]
        if not path.is_file() or path.is_symlink() or parent.is_symlink():
            issues.append(f"missing regular reference: {reference}")
    files: set[str] = set()
    for path in bundle.rglob("*"):
        relative = path.relative_to(bundle).as_posix()
        if path.is_symlink():
            issues.append(f"symlink is not portable: {relative}")
        elif path == skill_path:
            continue
        elif path.is_file():
            files.add(relative)
            if len(path.relative_to(bundle).parts) != 2:
                issues.append(f"file is not one level deep: {relative}")
                continue
            directory = path.relative_to(bundle).parts[0]
            allowed_suffixes = ALLOWED_SUFFIXES.get(directory)
            if allowed_suffixes is None or path.suffix.lower() not in allowed_suffixes:
                issues.append(f"unsupported {directory} file type: {relative}")
            if path.stat().st_size > MAX_COMPANION_FILE_BYTES:
                issues.append(
                    f"companion file exceeds {MAX_COMPANION_FILE_BYTES} bytes: {relative}"
                )
            if contains_obvious_secret(path.read_bytes()):
                issues.append(f"possible secret material in {relative}")
        elif not path.is_dir():
            issues.append(f"special file is not portable: {relative}")
    if contains_obvious_secret(skill_path.read_bytes()):
        issues.append("possible secret material in SKILL.md")
    for orphan in sorted(files - references):
        issues.append(f"unreferenced package file: {orphan}")
    return {"passed": not issues, "issues": issues, "references": sorted(references)}


def metrics(expected: list[bool], predicted: list[bool]) -> dict[str, float | int]:
    tp = sum(want and got for want, got in zip(expected, predicted))
    fp = sum(not want and got for want, got in zip(expected, predicted))
    tn = sum(not want and not got for want, got in zip(expected, predicted))
    fn = sum(want and not got for want, got in zip(expected, predicted))
    return {
        "truePositive": tp,
        "falsePositive": fp,
        "trueNegative": tn,
        "falseNegative": fn,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else 0.0,
    }


def artifact(text: str, contract: dict[str, object]) -> dict[str, object]:
    def has_heading(heading: object) -> bool:
        pattern = rf"^#{{1,6}}\s+{re.escape(str(heading))}\s*#*\s*$"
        return re.search(pattern, text, re.MULTILINE) is not None

    def has_term(term: object) -> bool:
        pattern = rf"(?<!\w){re.escape(str(term))}(?!\w)"
        return re.search(pattern, text, re.IGNORECASE) is not None

    missing_headings = [
        heading
        for heading in contract.get("requiredHeadings", [])
        if not has_heading(heading)
    ]
    missing_terms = [term for term in contract.get("requiredTerms", []) if not has_term(term)]
    forbidden = [term for term in contract.get("forbiddenTerms", []) if has_term(term)]
    return {"passed": not missing_headings and not missing_terms and not forbidden, "missingHeadings": missing_headings, "missingTerms": missing_terms, "forbiddenHits": forbidden}


def evidence_checks(config: dict[str, object], field: str) -> dict[str, object]:
    raw_checks = config.get(field)
    if not isinstance(raw_checks, list) or not raw_checks:
        raise ValueError(f"{field} must be a non-empty array")
    seen: set[str] = set()
    checks: list[dict[str, object]] = []
    for raw in raw_checks:
        if not isinstance(raw, dict):
            raise ValueError(f"every {field} entry must be an object")
        check_id = raw.get("id")
        passed = raw.get("passed")
        evidence = raw.get("evidence")
        if (
            not isinstance(check_id, str)
            or not check_id.strip()
            or check_id != check_id.strip()
            or check_id in seen
        ):
            raise ValueError(
                f"{field} ids must be unique non-empty strings without surrounding whitespace"
            )
        if type(passed) is not bool:
            raise ValueError(f"{field} check {check_id!r} needs a boolean verdict")
        if not isinstance(evidence, str) or not evidence.strip():
            raise ValueError(f"{field} check {check_id!r} needs evidence")
        seen.add(check_id)
        checks.append({"id": check_id, "passed": passed, "evidence": evidence})
    return {"passed": all(bool(check["passed"]) for check in checks), "cases": checks}


def verify_manifest(bundle: Path, config: dict[str, object]) -> dict[str, object]:
    if type(config.get("manifestVersion")) is not int or config.get(
        "manifestVersion"
    ) != 1:
        raise ValueError("manifestVersion must be the supported integer value 1")
    if config.get("algorithm") != "sha256":
        raise ValueError("manifest algorithm must be 'sha256'")
    raw_files = config.get("files")
    if not isinstance(raw_files, dict) or not raw_files:
        raise ValueError("manifest files must be a non-empty object")
    expected: dict[str, str] = {}
    issues: list[str] = []
    for raw_path, digest in raw_files.items():
        if not isinstance(raw_path, str) or not isinstance(digest, str):
            issues.append("manifest paths and digests must be strings")
            continue
        relative = PurePosixPath(raw_path)
        if (
            "\\" in raw_path
            or relative.is_absolute()
            or any(part in {"", ".", ".."} for part in relative.parts)
            or raw_path != relative.as_posix()
        ):
            issues.append(f"invalid manifest path: {raw_path!r}")
            continue
        if relative.as_posix() == RESERVED_MANIFEST_PATH:
            issues.append(f"reserved manifest path must not be listed: {raw_path!r}")
            continue
        if not SHA256_PATTERN.fullmatch(digest):
            issues.append(f"invalid manifest digest: {raw_path!r}")
            continue
        expected[relative.as_posix()] = digest

    actual: dict[str, str] = {}
    for path in sorted(bundle.rglob("*"), key=lambda item: item.as_posix()):
        relative = path.relative_to(bundle).as_posix()
        if path.is_symlink():
            issues.append(f"manifest tree contains a symlink: {relative}")
        elif relative == RESERVED_MANIFEST_PATH:
            if not path.is_file():
                issues.append("reserved manifest path must be a regular file")
        elif path.is_file():
            actual[relative] = f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"
        elif not path.is_dir():
            issues.append(f"manifest tree contains a special file: {relative}")
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    mismatched = sorted(
        path
        for path in set(expected) & set(actual)
        if expected[path] != actual[path]
    )
    return {
        "passed": not issues and not missing and not unexpected and not mismatched,
        "issues": issues,
        "missing": missing,
        "unexpected": unexpected,
        "mismatched": mismatched,
    }


def portability(config: dict[str, object]) -> list[dict[str, object]]:
    requirements = config["requirements"]
    rows = []
    for host in config["hosts"]:
        missing = []
        if not host["loadsCoreSkill"]:
            status = "unsupported"
            missing.append("core-skill-loader")
        else:
            if requirements["companionFiles"] and not host["preservesCompanionFiles"]:
                missing.append("companion-files")
            if requirements["scriptExecution"] and not host["runsBundledScripts"]:
                missing.append("script-execution")
            unsupported = set(requirements["runtimeExtensions"]) - set(host["supportedExtensions"])
            missing.extend(f"extension:{name}" for name in sorted(unsupported))
            status = "native" if not missing else "adapter-required"
        rows.append({"host": host["name"], "status": status, "missing": missing})
    return rows


def validate_configuration(
    case_config: dict[str, object], host_config: dict[str, object]
) -> None:
    terms = case_config.get("triggerTerms")
    if not isinstance(terms, list) or not terms or not all(isinstance(term, str) for term in terms):
        raise ValueError("triggerTerms must be a non-empty array of strings")
    threshold = case_config.get("threshold")
    if type(threshold) is not int or not 1 <= threshold <= len(set(terms)):
        raise ValueError("threshold must be an integer from 1 through the number of trigger terms")
    runs = case_config.get("runs")
    if type(runs) is not int or runs < 1:
        raise ValueError("runs must be a positive integer")
    for field in ("minimumPrecision", "minimumRecall", "minimumRepeatRate"):
        value = case_config.get(field)
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or not 0.0 <= value <= 1.0
        ):
            raise ValueError(f"{field} must be a finite number from 0 to 1")
    cases = case_config.get("cases")
    if not isinstance(cases, list) or not cases:
        raise ValueError("cases must be a non-empty array")
    if not all(
        isinstance(case, dict)
        and isinstance(case.get("id"), str)
        and isinstance(case.get("prompt"), str)
        and type(case.get("expected")) is bool
        for case in cases
    ):
        raise ValueError("every case needs string id/prompt and boolean expected")
    case_ids = [case["id"] for case in cases]
    if any(
        not case_id.strip() or case_id != case_id.strip() for case_id in case_ids
    ) or len(case_ids) != len(set(case_ids)):
        raise ValueError(
            "case ids must be unique non-empty strings without surrounding whitespace"
        )
    if any(
        not case["prompt"].strip()
        or case["prompt"] != case["prompt"].strip()
        for case in cases
    ):
        raise ValueError(
            "case prompts must be non-empty strings without surrounding whitespace"
        )
    if not any(case["expected"] for case in cases) or not any(
        not case["expected"] for case in cases
    ):
        raise ValueError("cases must include positives and near-miss negatives")
    mode = case_config.get("evaluationMode", "deterministic-fixture")
    if mode not in {"deterministic-fixture", "captured-observations"}:
        raise ValueError("evaluationMode is not supported")
    if mode == "captured-observations":
        for case in cases:
            observations = case.get("observedPredictions")
            if (
                not isinstance(observations, list)
                or len(observations) != runs
                or not all(type(value) is bool for value in observations)
            ):
                raise ValueError(
                    "captured-observations cases need one boolean prediction per run"
                )
    minimum_hosts = host_config.get("minimumNativeHosts")
    if type(minimum_hosts) is not int or minimum_hosts < 1:
        raise ValueError("minimumNativeHosts must be a positive integer")
    hosts = host_config.get("hosts")
    if not isinstance(hosts, list) or not hosts:
        raise ValueError("hosts must be a non-empty array")
    host_names = [
        host.get("name") if isinstance(host, dict) else None for host in hosts
    ]
    if (
        any(
            not isinstance(name, str)
            or not name.strip()
            or name != name.strip()
            for name in host_names
        )
        or len(host_names) != len(set(host_names))
    ):
        raise ValueError(
            "host names must be unique non-empty strings without surrounding whitespace"
        )
    for host in hosts:
        if not isinstance(host, dict):
            raise ValueError("every host must be an object")
        for field in ("loadsCoreSkill", "preservesCompanionFiles", "runsBundledScripts"):
            if type(host.get(field)) is not bool:
                raise ValueError(f"host {field} must be a JSON boolean")
        supported_extensions = host.get("supportedExtensions")
        if (
            not isinstance(supported_extensions, list)
            or not all(
                isinstance(field, str) and field for field in supported_extensions
            )
            or len(supported_extensions) != len(set(supported_extensions))
        ):
            raise ValueError(
                "host supportedExtensions must be unique non-empty strings"
            )
    requirements = host_config.get("requirements")
    if not isinstance(requirements, dict):
        raise ValueError("requirements must be an object")
    for field in ("companionFiles", "scriptExecution"):
        if type(requirements.get(field)) is not bool:
            raise ValueError(f"requirements {field} must be a JSON boolean")
    runtime_extensions = requirements.get("runtimeExtensions")
    if (
        not isinstance(runtime_extensions, list)
        or not all(isinstance(field, str) and field for field in runtime_extensions)
        or len(runtime_extensions) != len(set(runtime_extensions))
    ):
        raise ValueError("runtimeExtensions must be unique non-empty strings")


def validate_result_modes(
    artifact_config: dict[str, object], evidence_config: dict[str, object]
) -> dict[str, object]:
    artifact_mode = artifact_config.get("artifactMode")
    if artifact_mode not in SUPPORTED_ARTIFACT_MODES:
        raise ValueError(
            "artifactMode must be 'fixture' or 'captured-artifacts'"
        )
    evidence_mode = evidence_config.get("evidenceMode")
    if evidence_mode not in SUPPORTED_EVIDENCE_MODES:
        raise ValueError(
            "evidenceMode must be 'deterministic-fixture' or 'captured-results'"
        )
    artifact_issues: list[str] = []
    artifact_integrity = False
    if artifact_mode == "captured-artifacts":
        provenance = artifact_config.get("provenance")
        if not isinstance(provenance, dict):
            artifact_issues.append("captured artifacts need a provenance object")
        else:
            source = provenance.get("source")
            baseline = artifact_config.get("baseline")
            with_skill = artifact_config.get("withSkill")
            if not isinstance(source, str) or not source.strip():
                artifact_issues.append("artifact provenance needs a non-empty source")
            if not isinstance(baseline, str) or provenance.get(
                "baselineDigest"
            ) != digest_text(baseline if isinstance(baseline, str) else ""):
                artifact_issues.append("artifact baseline digest does not match")
            if not isinstance(with_skill, str) or provenance.get(
                "withSkillDigest"
            ) != digest_text(with_skill if isinstance(with_skill, str) else ""):
                artifact_issues.append("with-skill artifact digest does not match")
        artifact_integrity = not artifact_issues

    evidence_issues: list[str] = []
    evidence_integrity = False
    if evidence_mode == "captured-results":
        provenance = evidence_config.get("provenance")
        if not isinstance(provenance, dict):
            evidence_issues.append("captured evidence needs a provenance object")
        else:
            source = provenance.get("source")
            if not isinstance(source, str) or not source.strip():
                evidence_issues.append("evidence provenance needs a non-empty source")
            if provenance.get("checksDigest") != digest_evidence(evidence_config):
                evidence_issues.append("evidence checks digest does not match")
        evidence_integrity = not evidence_issues
    return {
        "artifactMode": artifact_mode,
        "evidenceMode": evidence_mode,
        "artifactIntegrity": artifact_integrity,
        "evidenceIntegrity": evidence_integrity,
        "issues": artifact_issues + evidence_issues,
    }


def validate_host_provenance(host_config: dict[str, object]) -> dict[str, object]:
    host_mode = host_config.get("hostMode")
    if host_mode not in SUPPORTED_HOST_MODES:
        raise ValueError(
            "hostMode must be 'deterministic-fixture' or 'captured-capabilities'"
        )
    issues: list[str] = []
    host_integrity = False
    if host_mode == "captured-capabilities":
        hosts = host_config.get("hosts")
        minimum_hosts = host_config.get("minimumNativeHosts")
        if not isinstance(hosts, list) or not hosts:
            issues.append("captured host capabilities need a non-empty host matrix")
        if type(minimum_hosts) is not int or minimum_hosts < 1:
            issues.append("captured host capabilities need a positive native-host threshold")
        provenance = host_config.get("provenance")
        if not isinstance(provenance, dict):
            issues.append("captured host capabilities need a provenance object")
        else:
            source = provenance.get("source")
            if not isinstance(source, str) or not source.strip():
                issues.append("host provenance needs a non-empty source")
            if provenance.get("matrixDigest") != digest_hosts(host_config):
                issues.append("host capability matrix digest does not match")
        host_integrity = not issues
    return {
        "hostMode": host_mode,
        "hostIntegrity": host_integrity,
        "hostIssues": issues,
    }


def validate_trigger_provenance(case_config: dict[str, object]) -> dict[str, object]:
    mode = case_config.get("evaluationMode", "deterministic-fixture")
    issues: list[str] = []
    trigger_integrity = False
    if mode == "captured-observations":
        provenance = case_config.get("provenance")
        if not isinstance(provenance, dict):
            issues.append("captured trigger observations need a provenance object")
        else:
            source = provenance.get("source")
            if not isinstance(source, str) or not source.strip():
                issues.append("trigger provenance needs a non-empty source")
            if provenance.get("observationsDigest") != digest_trigger_observations(
                case_config
            ):
                issues.append("trigger observation digest does not match")
        trigger_integrity = not issues
    return {
        "triggerMode": mode,
        "triggerIntegrity": trigger_integrity,
        "triggerIssues": issues,
    }


def release_readiness(
    checks_passed: bool,
    trigger_report: dict[str, object],
    mode_report: dict[str, object],
    host_report: dict[str, object],
    trust_anchor: dict[str, object] | None = None,
) -> dict[str, bool]:
    fixture_passed = checks_passed and (
        trigger_report["triggerMode"] == "deterministic-fixture"
        and mode_report["artifactMode"] == "fixture"
        and mode_report["evidenceMode"] == "deterministic-fixture"
        and host_report["hostMode"] == "deterministic-fixture"
    )
    local_evidence_ready = (
        bool(trigger_report["triggerIntegrity"])
        and bool(mode_report["artifactIntegrity"])
        and bool(mode_report["evidenceIntegrity"])
        and bool(host_report["hostIntegrity"])
    )
    trust_anchor_valid = bool(
        trust_anchor and trust_anchor.get("trustAnchorValid") is True
    )
    production_ready = (
        checks_passed and local_evidence_ready and trust_anchor_valid
    )
    return {
        "checksPassed": checks_passed,
        "fixturePassed": fixture_passed,
        "localEvidenceReady": local_evidence_ready,
        "trustAnchorValid": trust_anchor_valid,
        "productionReady": production_ready,
        "passed": production_ready,
    }


def evaluate(
    bundle: Path,
    attestation_path: Path | None = None,
    trusted_attestation_digest: str | None = None,
) -> dict[str, object]:
    preflight_bundle(bundle)
    case_config = read_json_object(bundle / "evals" / "cases.json", "cases.json")
    artifact_config = read_json_object(
        bundle / "evals" / "artifacts.json", "artifacts.json"
    )
    evidence_config = read_json_object(
        bundle / "evals" / "evidence.json", "evidence.json"
    )
    host_config = read_json_object(bundle / "assets" / "hosts.json", "hosts.json")
    manifest_config = read_json_object(
        bundle / "assets" / "manifest.json", "manifest.json"
    )
    validate_configuration(case_config, host_config)
    mode_report = validate_result_modes(
        artifact_config, evidence_config
    )
    host_report = validate_host_provenance(host_config)
    trigger_provenance = validate_trigger_provenance(case_config)
    terms = set(case_config["triggerTerms"])
    threshold = int(case_config["threshold"])
    cases = case_config["cases"]
    runs = int(case_config["runs"])
    mode = case_config.get("evaluationMode", "deterministic-fixture")
    observed_by_case: dict[str, list[bool]] = {}
    for case in cases:
        if mode == "captured-observations":
            observations = list(case["observedPredictions"])
        else:
            prediction = len(
                set(re.findall(r"[a-z0-9]+", case["prompt"].lower())) & terms
            ) >= threshold
            observations = [prediction] * runs
        observed_by_case[case["id"]] = observations
    expected_runs = [case["expected"] for case in cases for _ in range(runs)]
    predicted_runs = [
        prediction
        for case in cases
        for prediction in observed_by_case[case["id"]]
    ]
    trigger_metrics = metrics(expected_runs, predicted_runs)
    repeat_rates = {
        case["id"]: sum(
            prediction == case["expected"]
            for prediction in observed_by_case[case["id"]]
        )
        / runs
        for case in cases
    }
    baseline = artifact(artifact_config["baseline"], artifact_config["contract"])
    with_skill = artifact(artifact_config["withSkill"], artifact_config["contract"])
    scripts = evidence_checks(evidence_config, "scriptChecks")
    safety = evidence_checks(evidence_config, "safetyChecks")
    installed_tree = verify_manifest(bundle, manifest_config)
    host_rows = portability(host_config)
    structure = lint(bundle, host_config["requirements"]["runtimeExtensions"])
    checks = {
        "structure": structure["passed"],
        "precision": trigger_metrics["precision"] >= case_config["minimumPrecision"],
        "recall": trigger_metrics["recall"] >= case_config["minimumRecall"],
        "repeatedRuns": min(repeat_rates.values()) >= case_config["minimumRepeatRate"],
        "artifactImprovement": not baseline["passed"] and with_skill["passed"],
        "scriptCorrectness": scripts["passed"],
        "safety": safety["passed"],
        "installedTree": installed_tree["passed"],
        "nativeHosts": sum(row["status"] == "native" for row in host_rows) >= host_config["minimumNativeHosts"],
    }
    evidence_root = local_evidence_root(
        case_config,
        artifact_config,
        evidence_config,
        host_config,
        manifest_config,
    )
    trust_anchor = verify_external_attestation(
        bundle,
        evidence_root,
        attestation_path,
        trusted_attestation_digest,
    )
    readiness = release_readiness(
        all(checks.values()),
        trigger_provenance,
        mode_report,
        host_report,
        trust_anchor,
    )
    provenance_report = {
        **trigger_provenance,
        **mode_report,
        **host_report,
        "issues": [*trigger_provenance["triggerIssues"], *mode_report["issues"], *host_report["hostIssues"]],
    }
    return {**readiness, "evidenceRoot": evidence_root, "trustAnchor": trust_anchor, "evaluationMode": mode, "artifactMode": mode_report["artifactMode"], "evidenceMode": mode_report["evidenceMode"], "hostMode": host_report["hostMode"], "provenance": provenance_report, "checks": checks, "structure": structure, "triggerMetrics": trigger_metrics, "repeatRates": repeat_rates, "triggerObservations": observed_by_case, "artifacts": {"baseline": baseline, "withSkill": with_skill}, "scripts": scripts, "safety": safety, "installedTree": installed_tree, "portability": host_rows}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", nargs="?", type=Path, default=Path("."))
    parser.add_argument(
        "--fixture-demo",
        action="store_true",
        help="exit successfully for a passing lesson fixture without claiming release readiness",
    )
    parser.add_argument(
        "--attestation",
        type=Path,
        help="external JSON attestation that binds the evaluated evidence root",
    )
    parser.add_argument(
        "--trusted-attestation-sha256",
        help="out-of-band trusted sha256:<hex> digest of the exact attestation bytes",
    )
    args = parser.parse_args()
    try:
        result = evaluate(
            args.bundle.absolute(),
            args.attestation.absolute() if args.attestation is not None else None,
            args.trusted_attestation_sha256,
        )
    except (
        AttributeError,
        IndexError,
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        result = {"passed": False, "error": "invalid-evaluation-config", "reason": str(error)}
        print(json.dumps(result, indent=2, sort_keys=True))
        raise SystemExit(2) from error
    print(json.dumps(result, indent=2, sort_keys=True))
    if not result["passed"] and not (
        args.fixture_demo and result.get("fixturePassed") is True
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
