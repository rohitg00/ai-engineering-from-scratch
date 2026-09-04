from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable, Mapping, Sequence


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


@dataclass(frozen=True)
class LintIssue:
    code: str
    message: str


@dataclass(frozen=True)
class LintReport:
    valid: bool
    references: tuple[str, ...]
    issues: tuple[LintIssue, ...]


def _frontmatter_and_body(path: Path) -> tuple[dict[str, str], str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        raise ValueError("SKILL.md needs exact frontmatter delimiters")
    end = lines.index("---", 1)
    fields: dict[str, str] = {}
    index = 1
    while index < end:
        line = lines[index]
        if not line.strip() or line.lstrip().startswith("#"):
            index += 1
            continue
        if line[:1].isspace() or ":" not in line:
            raise ValueError(f"malformed top-level line {index + 1}")
        key, value = line.split(":", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", key):
            raise ValueError(f"invalid frontmatter field {key!r}")
        if key in fields:
            raise ValueError(f"duplicate frontmatter field {key!r}")
        value = value.strip()
        if key == "metadata" and not value:
            nested: dict[str, str] = {}
            index += 1
            while index < end and (not lines[index] or lines[index][:1].isspace()):
                nested_line = lines[index].strip()
                if nested_line:
                    if ":" not in nested_line:
                        raise ValueError(f"malformed metadata line {index + 1}")
                    nested_key, nested_value = nested_line.split(":", 1)
                    nested_key = nested_key.strip()
                    if (
                        not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*", nested_key)
                        or nested_key in nested
                    ):
                        raise ValueError(f"invalid metadata field {nested_key!r}")
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
    return fields, "\n".join(lines[end + 1 :]).strip()


def _bundle_paths(body: str) -> tuple[str, ...]:
    paths: set[str] = set()
    for code_span in re.findall(r"`([^`]+)`", body):
        for raw_token in code_span.split():
            token = raw_token.strip("()[]{}<>,;:'\"").rstrip(".,;:")
            if any(
                marker in token
                for marker in ("references/", "scripts/", "assets/", "evals/")
            ):
                paths.add(token)
    return tuple(sorted(paths))


def _section_has_content(body: str, title: str) -> bool:
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


def _contains_obvious_secret(data: bytes) -> bool:
    return any(pattern.search(data) is not None for pattern in SECRET_PATTERNS)


def lint_package(
    root: Path, allowed_runtime_extensions: Iterable[str] = ()
) -> LintReport:
    issues: list[LintIssue] = []
    skill_path = root / "SKILL.md"
    if not root.is_dir() or root.is_symlink():
        return LintReport(False, (), (LintIssue("bundle-directory", "regular bundle directory required"),))
    if not skill_path.is_file() or skill_path.is_symlink():
        return LintReport(False, (), (LintIssue("skill-file", "regular SKILL.md required"),))
    try:
        fields, body = _frontmatter_and_body(skill_path)
    except ValueError as error:
        return LintReport(False, (), (LintIssue("frontmatter", str(error)),))

    name = fields.get("name", "")
    description = fields.get("description", "")
    if not name or len(name) > 64 or not NAME_PATTERN.fullmatch(name):
        issues.append(LintIssue("name-format", "name must be kebab-case and at most 64 characters"))
    if name != root.name:
        issues.append(LintIssue("name-directory", "frontmatter name must match bundle directory"))
    if not description:
        issues.append(LintIssue("description", "description is required"))
    elif len(description) > 1024:
        issues.append(LintIssue("description-length", "description must be at most 1024 characters"))
    if not body:
        issues.append(LintIssue("body", "instruction body is required"))
    elif len(body) > MAX_SKILL_BODY_CHARS:
        issues.append(
            LintIssue(
                "body-size",
                f"instruction body exceeds {MAX_SKILL_BODY_CHARS} characters",
            )
        )
    if not _section_has_content(body, "Output contract"):
        issues.append(
            LintIssue(
                "output-contract",
                "a non-empty ## Output contract section is required",
            )
        )
    if not _section_has_content(body, "Failure behavior"):
        issues.append(
            LintIssue(
                "failure-behavior",
                "a non-empty ## Failure behavior section is required",
            )
        )

    allowed_extensions = set(allowed_runtime_extensions)
    for field in sorted(set(fields) - CORE_FIELDS):
        if field not in allowed_extensions:
            issues.append(
                LintIssue(
                    "runtime-extension",
                    f"runtime field {field!r} is not explicitly allowed",
                )
            )

    references = _bundle_paths(body)
    for reference in references:
        if "\\" in reference:
            issues.append(LintIssue("reference-shape", f"invalid direct reference {reference!r}"))
            continue
        relative = PurePosixPath(reference)
        if (
            relative.is_absolute()
            or any(part in {"", ".", ".."} for part in relative.parts)
            or len(relative.parts) != 2
            or relative.parts[0] not in {"references", "scripts", "assets", "evals"}
        ):
            issues.append(LintIssue("reference-shape", f"invalid direct reference {reference!r}"))
            continue
        parent = root / relative.parts[0]
        target = parent / relative.parts[1]
        if parent.is_symlink() or not target.is_file() or target.is_symlink():
            issues.append(LintIssue("reference-missing", f"missing regular file {reference!r}"))

    packaged_files: set[str] = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            issues.append(LintIssue("symlink", f"symlink is not portable: {path.relative_to(root)}"))
        elif path == skill_path:
            continue
        elif path.is_file():
            relative = path.relative_to(root).as_posix()
            packaged_files.add(relative)
            if len(path.relative_to(root).parts) != 2:
                issues.append(LintIssue("package-depth", f"file is not one level deep: {relative}"))
                continue
            directory = path.relative_to(root).parts[0]
            allowed_suffixes = ALLOWED_SUFFIXES.get(directory)
            if allowed_suffixes is None or path.suffix.lower() not in allowed_suffixes:
                issues.append(
                    LintIssue(
                        "file-type",
                        f"unsupported {directory} file type: {relative}",
                    )
                )
            if path.stat().st_size > MAX_COMPANION_FILE_BYTES:
                issues.append(
                    LintIssue(
                        "file-size",
                        f"companion file exceeds {MAX_COMPANION_FILE_BYTES} bytes: {relative}",
                    )
                )
            if _contains_obvious_secret(path.read_bytes()):
                issues.append(
                    LintIssue(
                        "secret-material",
                        f"possible secret material in {relative}",
                    )
                )
        elif not path.is_dir():
            issues.append(
                LintIssue(
                    "special-file",
                    f"special file is not portable: {path.relative_to(root)}",
                )
            )
    if _contains_obvious_secret(skill_path.read_bytes()):
        issues.append(LintIssue("secret-material", "possible secret material in SKILL.md"))
    for orphan in sorted(packaged_files - set(references)):
        issues.append(LintIssue("orphan-file", f"SKILL.md does not directly reference {orphan!r}"))
    return LintReport(not issues, references, tuple(issues))


@dataclass(frozen=True)
class TriggerCase:
    case_id: str
    prompt: str
    expected: bool


@dataclass(frozen=True)
class KeywordRouter:
    terms: tuple[str, ...]
    threshold: int = 2

    def __call__(self, prompt: str, run_index: int = 0) -> bool:
        del run_index
        prompt_terms = set(re.findall(r"[a-z0-9]+", prompt.lower()))
        return len(prompt_terms & set(self.terms)) >= self.threshold


def _validate_trigger_cases(cases: Sequence[TriggerCase]) -> None:
    seen: set[str] = set()
    for case in cases:
        if (
            not isinstance(case.case_id, str)
            or not case.case_id.strip()
            or case.case_id != case.case_id.strip()
            or case.case_id in seen
        ):
            raise ValueError("trigger case ids must be unique and non-empty")
        if (
            not isinstance(case.prompt, str)
            or not case.prompt.strip()
            or case.prompt != case.prompt.strip()
        ):
            raise ValueError(
                "trigger prompts must be non-empty and have no surrounding whitespace"
            )
        seen.add(case.case_id)


def classification_metrics(
    expected: Sequence[bool], predicted: Sequence[bool]
) -> dict[str, float | int]:
    if len(expected) != len(predicted):
        raise ValueError("expected and predicted lengths must match")
    tp = sum(want and got for want, got in zip(expected, predicted))
    fp = sum(not want and got for want, got in zip(expected, predicted))
    tn = sum(not want and not got for want, got in zip(expected, predicted))
    fn = sum(want and not got for want, got in zip(expected, predicted))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    accuracy = (tp + tn) / len(expected) if expected else 0.0
    return {
        "true_positive": tp,
        "false_positive": fp,
        "true_negative": tn,
        "false_negative": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round(accuracy, 4),
    }


def evaluate_triggers(
    cases: Sequence[TriggerCase], router: Callable[[str, int], bool]
) -> dict[str, object]:
    observations = repeated_run_observations(cases, router, 1)
    return trigger_report_from_observations(cases, observations)


def trigger_report_from_observations(
    cases: Sequence[TriggerCase], observations: Mapping[str, Sequence[bool]]
) -> dict[str, object]:
    _validate_trigger_cases(cases)
    if set(observations) != {case.case_id for case in cases} or any(
        not observations[case.case_id]
        or any(type(value) is not bool for value in observations[case.case_id])
        for case in cases
    ):
        raise ValueError("every trigger case needs at least one boolean observation")
    expected = [
        case.expected
        for case in cases
        for _ in observations[case.case_id]
    ]
    predicted = [
        value
        for case in cases
        for value in observations[case.case_id]
    ]
    metrics = classification_metrics(expected, predicted)
    return {
        "metrics": metrics,
        "cases": [
            {
                "id": case.case_id,
                "expected": case.expected,
                "predicted": observations[case.case_id][0],
                "observed_predictions": list(observations[case.case_id]),
                "passed": all(
                    case.expected == prediction
                    for prediction in observations[case.case_id]
                ),
            }
            for case in cases
        ],
    }


def repeated_run_observations(
    cases: Sequence[TriggerCase],
    router: Callable[[str, int], bool],
    runs: int,
) -> dict[str, tuple[bool, ...]]:
    if runs < 1:
        raise ValueError("runs must be positive")
    _validate_trigger_cases(cases)
    return {
        case.case_id: tuple(bool(router(case.prompt, run)) for run in range(runs))
        for case in cases
    }


def rates_from_observations(
    cases: Sequence[TriggerCase], observations: Mapping[str, Sequence[bool]]
) -> dict[str, float]:
    _validate_trigger_cases(cases)
    if set(observations) != {case.case_id for case in cases} or any(
        not observations[case.case_id]
        or any(type(value) is not bool for value in observations[case.case_id])
        for case in cases
    ):
        raise ValueError("every trigger case needs at least one boolean observation")
    return {
        case.case_id: round(
            sum(value == case.expected for value in observations[case.case_id])
            / len(observations[case.case_id]),
            4,
        )
        for case in cases
    }


def repeated_run_rates(
    cases: Sequence[TriggerCase],
    router: Callable[[str, int], bool],
    runs: int,
) -> dict[str, float]:
    observations = repeated_run_observations(cases, router, runs)
    return rates_from_observations(cases, observations)


@dataclass(frozen=True)
class ArtifactContract:
    required_headings: tuple[str, ...] = ()
    required_terms: tuple[str, ...] = ()
    forbidden_terms: tuple[str, ...] = ()


def evaluate_artifact(text: str, contract: ArtifactContract) -> dict[str, object]:
    def has_heading(heading: str) -> bool:
        pattern = rf"^#{{1,6}}\s+{re.escape(heading)}\s*#*\s*$"
        return re.search(pattern, text, re.MULTILINE) is not None

    def has_term(term: str) -> bool:
        pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
        return re.search(pattern, text, re.IGNORECASE) is not None

    missing_headings = [
        heading
        for heading in contract.required_headings
        if not has_heading(heading)
    ]
    missing_terms = [term for term in contract.required_terms if not has_term(term)]
    forbidden_hits = [term for term in contract.forbidden_terms if has_term(term)]
    passed = not missing_headings and not missing_terms and not forbidden_hits
    return {
        "passed": passed,
        "missing_headings": missing_headings,
        "missing_terms": missing_terms,
        "forbidden_hits": forbidden_hits,
    }


def compare_artifacts(
    baseline: str, with_skill: str, contract: ArtifactContract
) -> dict[str, object]:
    baseline_result = evaluate_artifact(baseline, contract)
    skill_result = evaluate_artifact(with_skill, contract)
    return {
        "baseline": baseline_result,
        "with_skill": skill_result,
        "skill_improves_pass_state": not baseline_result["passed"] and skill_result["passed"],
    }


@dataclass(frozen=True)
class EvidenceCheck:
    check_id: str
    passed: bool
    evidence: str


def evaluate_evidence_checks(
    cases: Sequence[EvidenceCheck], layer: str
) -> dict[str, object]:
    if not cases:
        raise ValueError(f"{layer} requires at least one explicit check")
    seen: set[str] = set()
    normalized: list[dict[str, object]] = []
    for case in cases:
        if (
            not isinstance(case.check_id, str)
            or not case.check_id.strip()
            or case.check_id != case.check_id.strip()
            or case.check_id in seen
        ):
            raise ValueError(
                f"{layer} check ids must be unique non-empty strings without surrounding whitespace"
            )
        if type(case.passed) is not bool:
            raise ValueError(f"{layer} check {case.check_id!r} needs a boolean verdict")
        if not isinstance(case.evidence, str) or not case.evidence.strip():
            raise ValueError(f"{layer} check {case.check_id!r} needs evidence")
        seen.add(case.check_id)
        normalized.append(asdict(case))
    return {"passed": all(case.passed for case in cases), "cases": normalized}


def build_manifest(root: Path) -> dict[str, str]:
    if not root.is_dir() or root.is_symlink():
        raise ValueError("manifest root must be a regular directory")
    manifest: dict[str, str] = {}
    for path in sorted(root.rglob("*"), key=lambda item: item.as_posix()):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise ValueError(f"manifest tree contains a symlink: {relative}")
        if relative == RESERVED_MANIFEST_PATH:
            if not path.is_file():
                raise ValueError("reserved manifest path must be a regular file")
            continue
        if path.is_file():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            manifest[relative] = f"sha256:{digest}"
        elif not path.is_dir():
            raise ValueError(f"manifest tree contains a special file: {relative}")
    if not manifest:
        raise ValueError("manifest cannot describe an empty directory")
    return manifest


def verify_manifest(root: Path, expected: Mapping[str, str]) -> dict[str, object]:
    issues: list[str] = []
    normalized: dict[str, str] = {}
    for raw_path, digest in expected.items():
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
            issues.append(
                f"reserved manifest path must not be listed: {raw_path!r}"
            )
            continue
        if not SHA256_PATTERN.fullmatch(digest):
            issues.append(f"invalid manifest digest: {raw_path!r}")
            continue
        normalized[relative.as_posix()] = digest
    try:
        actual = build_manifest(root)
    except ValueError as error:
        issues.append(str(error))
        actual = {}
    missing = sorted(set(normalized) - set(actual))
    unexpected = sorted(set(actual) - set(normalized))
    mismatched = sorted(
        path
        for path in set(normalized) & set(actual)
        if normalized[path] != actual[path]
    )
    return {
        "passed": not issues and not missing and not unexpected and not mismatched,
        "issues": issues,
        "missing": missing,
        "unexpected": unexpected,
        "mismatched": mismatched,
    }


@dataclass(frozen=True)
class PackageRequirements:
    companion_files: bool = False
    script_execution: bool = False
    runtime_extensions: tuple[str, ...] = ()


@dataclass(frozen=True)
class HostCapabilities:
    name: str
    loads_core_skill: bool
    preserves_companion_files: bool
    runs_bundled_scripts: bool
    supported_extensions: tuple[str, ...] = ()


def portability_matrix(
    requirements: PackageRequirements,
    hosts: Iterable[HostCapabilities],
) -> tuple[dict[str, object], ...]:
    rows: list[dict[str, object]] = []
    seen_hosts: set[str] = set()
    for host in hosts:
        if (
            not isinstance(host.name, str)
            or not host.name.strip()
            or host.name != host.name.strip()
            or host.name in seen_hosts
        ):
            raise ValueError("host names must be unique and non-empty")
        seen_hosts.add(host.name)
        missing: list[str] = []
        if not host.loads_core_skill:
            status = "unsupported"
            missing.append("core-skill-loader")
        else:
            if requirements.companion_files and not host.preserves_companion_files:
                missing.append("companion-files")
            if requirements.script_execution and not host.runs_bundled_scripts:
                missing.append("script-execution")
            unsupported_extensions = sorted(
                set(requirements.runtime_extensions) - set(host.supported_extensions)
            )
            missing.extend(f"extension:{field}" for field in unsupported_extensions)
            status = "native" if not missing else "adapter-required"
        rows.append({"host": host.name, "status": status, "missing": missing})
    return tuple(rows)


@dataclass(frozen=True)
class ReleaseThresholds:
    min_precision: float = 0.8
    min_recall: float = 0.8
    min_repeat_rate: float = 0.9
    min_native_hosts: int = 1

    def __post_init__(self) -> None:
        for field_name in ("min_precision", "min_recall", "min_repeat_rate"):
            value = getattr(self, field_name)
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                or not 0.0 <= value <= 1.0
            ):
                raise ValueError(f"{field_name} must be a finite number from 0 to 1")
        if type(self.min_native_hosts) is not int or self.min_native_hosts < 1:
            raise ValueError("min_native_hosts must be a positive integer")


@dataclass(frozen=True)
class EvaluationProvenance:
    trigger_mode: str = "deterministic-fixture"
    artifact_mode: str = "fixture"
    evidence_mode: str = "deterministic-fixture"
    host_mode: str = "deterministic-fixture"
    artifact_source: str = ""
    evidence_source: str = ""
    host_source: str = ""
    trigger_source: str = ""
    baseline_digest: str = ""
    with_skill_digest: str = ""
    checks_digest: str = ""
    host_digest: str = ""
    trigger_digest: str = ""


def artifact_digest(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def bytes_digest(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def _canonical_digest(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return bytes_digest(encoded)


def evidence_digest(
    script_checks: Sequence[EvidenceCheck], safety_checks: Sequence[EvidenceCheck]
) -> str:
    payload = {
        "script_checks": [asdict(check) for check in script_checks],
        "safety_checks": [asdict(check) for check in safety_checks],
    }
    return _canonical_digest(payload)


def host_matrix_digest(
    requirements: PackageRequirements, hosts: Sequence[HostCapabilities]
) -> str:
    payload = {
        "requirements": asdict(requirements),
        "hosts": [asdict(host) for host in hosts],
    }
    return _canonical_digest(payload)


def trigger_results_digest(
    cases: Sequence[TriggerCase],
    observations: Mapping[str, Sequence[bool]],
) -> str:
    trigger_report_from_observations(cases, observations)
    payload = {
        "cases": [asdict(case) for case in cases],
        "observations": {
            case.case_id: list(observations[case.case_id]) for case in cases
        },
    }
    return _canonical_digest(payload)


def local_evidence_root(
    cases: Sequence[TriggerCase],
    observations: Mapping[str, Sequence[bool]],
    baseline_artifact: str,
    with_skill_artifact: str,
    artifact_contract: ArtifactContract,
    script_checks: Sequence[EvidenceCheck],
    safety_checks: Sequence[EvidenceCheck],
    requirements: PackageRequirements,
    hosts: Sequence[HostCapabilities],
    manifest: Mapping[str, str],
    thresholds: ReleaseThresholds,
    provenance: EvaluationProvenance,
) -> str:
    trigger_report_from_observations(cases, observations)
    payload = {
        "triggers": {
            "cases": [asdict(case) for case in cases],
            "observations": {
                case.case_id: list(observations[case.case_id]) for case in cases
            },
        },
        "artifacts": {
            "baseline": baseline_artifact,
            "withSkill": with_skill_artifact,
            "contract": asdict(artifact_contract),
        },
        "evidence": {
            "scriptChecks": [asdict(check) for check in script_checks],
            "safetyChecks": [asdict(check) for check in safety_checks],
        },
        "portability": {
            "requirements": asdict(requirements),
            "minimumNativeHosts": thresholds.min_native_hosts,
            "hosts": [asdict(host) for host in hosts],
        },
        "manifest": dict(manifest),
        "thresholds": asdict(thresholds),
        "provenance": asdict(provenance),
    }
    return _canonical_digest(payload)


def build_external_attestation(evidence_root: str) -> bytes:
    if not SHA256_PATTERN.fullmatch(evidence_root):
        raise ValueError("evidence root must be a SHA-256 digest")
    return json.dumps(
        {
            "attestationVersion": ATTESTATION_VERSION,
            "evidenceRoot": evidence_root,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def verify_external_attestation(
    evidence_root: str,
    attestation_payload: bytes | None,
    trusted_attestation_digest: str | None,
) -> dict[str, object]:
    issues: list[str] = []
    if attestation_payload is None:
        issues.append("trusted external attestation was not supplied")
    if trusted_attestation_digest is None:
        issues.append("trusted attestation SHA-256 was not supplied out of band")
    if issues:
        return {"valid": False, "issues": issues, "attestation_digest": None}
    if not isinstance(attestation_payload, bytes):
        return {
            "valid": False,
            "issues": ["external attestation payload must be bytes"],
            "attestation_digest": None,
        }
    assert trusted_attestation_digest is not None
    actual_digest = bytes_digest(attestation_payload)
    if not SHA256_PATTERN.fullmatch(trusted_attestation_digest):
        issues.append("trusted attestation SHA-256 has an invalid format")
    elif actual_digest != trusted_attestation_digest:
        issues.append("external attestation does not match the trusted SHA-256")
    try:
        decoded = json.loads(attestation_payload.decode("utf-8"))
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
                issues.append("attestationVersion must be the supported integer value 1")
            if decoded.get("evidenceRoot") != evidence_root:
                issues.append("external attestation evidenceRoot does not match")
    return {
        "valid": not issues,
        "issues": issues,
        "attestation_digest": actual_digest,
    }


def evaluate_provenance(
    provenance: EvaluationProvenance,
    baseline_artifact: str,
    with_skill_artifact: str,
    script_checks: Sequence[EvidenceCheck],
    safety_checks: Sequence[EvidenceCheck],
    requirements: PackageRequirements,
    hosts: Sequence[HostCapabilities],
    cases: Sequence[TriggerCase],
    observations: Mapping[str, Sequence[bool]],
) -> dict[str, object]:
    if provenance.trigger_mode not in {
        "deterministic-fixture",
        "captured-observations",
    }:
        raise ValueError("unsupported trigger provenance mode")
    if provenance.artifact_mode not in {"fixture", "captured-artifacts"}:
        raise ValueError("unsupported artifact provenance mode")
    if provenance.evidence_mode not in {
        "deterministic-fixture",
        "captured-results",
    }:
        raise ValueError("unsupported evidence provenance mode")
    if provenance.host_mode not in {
        "deterministic-fixture",
        "captured-capabilities",
    }:
        raise ValueError("unsupported host provenance mode")

    issues: list[str] = []
    trigger_integrity = False
    if provenance.trigger_mode == "captured-observations":
        trigger_issue_count = len(issues)
        if not provenance.trigger_source.strip():
            issues.append("captured trigger observations need a non-empty source")
        if provenance.trigger_digest != trigger_results_digest(cases, observations):
            issues.append("trigger observation digest does not match")
        trigger_integrity = len(issues) == trigger_issue_count

    artifact_issue_count = len(issues)
    artifact_integrity = False
    if provenance.artifact_mode == "captured-artifacts":
        if not provenance.artifact_source.strip():
            issues.append("captured artifacts need a non-empty source")
        if provenance.baseline_digest != artifact_digest(baseline_artifact):
            issues.append("artifact baseline digest does not match")
        if provenance.with_skill_digest != artifact_digest(with_skill_artifact):
            issues.append("with-skill artifact digest does not match")
        artifact_integrity = len(issues) == artifact_issue_count

    evidence_issue_count = len(issues)
    evidence_integrity = False
    if provenance.evidence_mode == "captured-results":
        if not provenance.evidence_source.strip():
            issues.append("captured evidence needs a non-empty source")
        if provenance.checks_digest != evidence_digest(script_checks, safety_checks):
            issues.append("evidence checks digest does not match")
        evidence_integrity = len(issues) == evidence_issue_count
    host_issue_count = len(issues)
    host_integrity = False
    if provenance.host_mode == "captured-capabilities":
        if not provenance.host_source.strip():
            issues.append("captured host capabilities need a non-empty source")
        if provenance.host_digest != host_matrix_digest(requirements, hosts):
            issues.append("host capability matrix digest does not match")
        host_integrity = len(issues) == host_issue_count
    return {
        "triggerMode": provenance.trigger_mode,
        "artifactMode": provenance.artifact_mode,
        "evidenceMode": provenance.evidence_mode,
        "hostMode": provenance.host_mode,
        "triggerIntegrity": trigger_integrity,
        "artifactIntegrity": artifact_integrity,
        "evidenceIntegrity": evidence_integrity,
        "hostIntegrity": host_integrity,
        "issues": issues,
    }


def run_release_gate(
    package_root: Path,
    cases: Sequence[TriggerCase],
    router: Callable[[str, int], bool],
    runs: int,
    baseline_artifact: str,
    with_skill_artifact: str,
    artifact_contract: ArtifactContract,
    requirements: PackageRequirements,
    hosts: Iterable[HostCapabilities],
    script_checks: Sequence[EvidenceCheck],
    safety_checks: Sequence[EvidenceCheck],
    installed_root: Path,
    manifest: Mapping[str, str],
    provenance: EvaluationProvenance = EvaluationProvenance(),
    thresholds: ReleaseThresholds = ReleaseThresholds(),
    attestation_payload: bytes | None = None,
    trusted_attestation_digest: str | None = None,
) -> dict[str, object]:
    _validate_trigger_cases(cases)
    if not cases or not any(case.expected for case in cases) or not any(
        not case.expected for case in cases
    ):
        raise ValueError("release gate requires positive and near-miss negative trigger cases")
    lint = lint_package(package_root, requirements.runtime_extensions)
    observations = repeated_run_observations(cases, router, runs)
    triggers = trigger_report_from_observations(cases, observations)
    rates = rates_from_observations(cases, observations)
    artifacts = compare_artifacts(baseline_artifact, with_skill_artifact, artifact_contract)
    host_list = tuple(hosts)
    if not host_list:
        raise ValueError("release gate requires at least one host capability record")
    portability = portability_matrix(requirements, host_list)
    scripts = evaluate_evidence_checks(script_checks, "script correctness")
    safety = evaluate_evidence_checks(safety_checks, "safety")
    source_manifest = verify_manifest(package_root, manifest)
    installed_manifest = verify_manifest(installed_root, manifest)
    provenance_report = evaluate_provenance(
        provenance,
        baseline_artifact,
        with_skill_artifact,
        script_checks,
        safety_checks,
        requirements,
        host_list,
        cases,
        observations,
    )
    if package_root.resolve() == installed_root.resolve():
        installed_manifest = {
            **installed_manifest,
            "passed": False,
            "issues": [
                *installed_manifest["issues"],
                "installed tree must be distinct from the source bundle",
            ],
        }
    metrics = triggers["metrics"]
    assert isinstance(metrics, dict)
    native_hosts = sum(row["status"] == "native" for row in portability)
    checks = {
        "structure": lint.valid,
        "precision": float(metrics["precision"]) >= thresholds.min_precision,
        "recall": float(metrics["recall"]) >= thresholds.min_recall,
        "repeated_runs": min(rates.values(), default=0.0) >= thresholds.min_repeat_rate,
        "with_skill_artifact": bool(artifacts["with_skill"]["passed"]),
        "artifact_improvement": bool(artifacts["skill_improves_pass_state"]),
        "script_correctness": bool(scripts["passed"]),
        "safety": bool(safety["passed"]),
        "source_manifest": bool(source_manifest["passed"]),
        "installed_tree": bool(installed_manifest["passed"]),
        "native_hosts": native_hosts >= thresholds.min_native_hosts,
    }
    checks_passed = all(checks.values())
    fixture_passed = checks_passed and (
        provenance_report["triggerMode"] == "deterministic-fixture"
        and provenance_report["artifactMode"] == "fixture"
        and provenance_report["evidenceMode"] == "deterministic-fixture"
        and provenance_report["hostMode"] == "deterministic-fixture"
    )
    local_evidence_ready = (
        bool(provenance_report["triggerIntegrity"])
        and bool(provenance_report["artifactIntegrity"])
        and bool(provenance_report["evidenceIntegrity"])
        and bool(provenance_report["hostIntegrity"])
    )
    evidence_root = local_evidence_root(
        cases,
        observations,
        baseline_artifact,
        with_skill_artifact,
        artifact_contract,
        script_checks,
        safety_checks,
        requirements,
        host_list,
        manifest,
        thresholds,
        provenance,
    )
    trust_anchor = verify_external_attestation(
        evidence_root, attestation_payload, trusted_attestation_digest
    )
    trust_anchor_valid = bool(trust_anchor["valid"])
    production_ready = (
        checks_passed and local_evidence_ready and trust_anchor_valid
    )
    return {
        "passed": production_ready,
        "checks_passed": checks_passed,
        "fixture_passed": fixture_passed,
        "local_evidence_ready": local_evidence_ready,
        "trust_anchor_valid": trust_anchor_valid,
        "production_ready": production_ready,
        "evidence_root": evidence_root,
        "trust_anchor": trust_anchor,
        "checks": checks,
        "provenance": provenance_report,
        "lint": {
            "valid": lint.valid,
            "references": list(lint.references),
            "issues": [asdict(issue) for issue in lint.issues],
        },
        "triggers": triggers,
        "trigger_observations": {
            case.case_id: list(observations[case.case_id]) for case in cases
        },
        "repeated_run_rates": rates,
        "artifacts": artifacts,
        "scripts": scripts,
        "safety": safety,
        "packaging": {
            "source_manifest": source_manifest,
            "installed_tree": installed_manifest,
        },
        "portability": list(portability),
    }


def demo() -> None:
    package_root = Path(__file__).resolve().parents[1] / "outputs" / "skill-release-gate"
    cases = (
        TriggerCase("positive-package", "evaluate this skill package before release", True),
        TriggerCase("positive-trigger", "measure skill trigger precision and recall", True),
        TriggerCase("positive-portability", "check bundle portability across hosts", True),
        TriggerCase("near-release-notes", "publish release notes", False),
        TriggerCase("near-model-eval", "evaluate model response quality", False),
        TriggerCase("near-dependency", "install package dependencies", False),
    )
    router = KeywordRouter(
        ("skill", "package", "bundle", "trigger", "portability", "evaluate", "release"),
        threshold=2,
    )
    contract = ArtifactContract(
        required_headings=("Decision", "Evidence"),
        required_terms=("precision", "recall"),
        forbidden_terms=("guaranteed portable",),
    )
    baseline = "Release looks fine."
    with_skill = "# Decision\n\nPass.\n\n# Evidence\n\nPrecision: 1.0. Recall: 1.0."
    hosts = (
        HostCapabilities("native-host", True, True, True),
        HostCapabilities("metadata-only-host", True, False, False),
        HostCapabilities("prompt-only-host", False, False, False),
    )
    scripts = (
        EvidenceCheck("unit-fixtures", True, "Deterministic script fixtures passed."),
        EvidenceCheck("repeat-run", True, "A repeated fixture run produced the same output."),
    )
    safety = (
        EvidenceCheck("path-traversal", True, "Traversal reference was rejected."),
        EvidenceCheck("undeclared-network", True, "No network authority was granted."),
        EvidenceCheck("external-write", True, "No external write was attempted."),
    )
    manifest = build_manifest(package_root)
    with tempfile.TemporaryDirectory(prefix="lesson-27-install-") as temp_dir:
        installed_root = Path(temp_dir) / package_root.name
        shutil.copytree(package_root, installed_root)
        report = run_release_gate(
            package_root,
            cases,
            router,
            runs=5,
            baseline_artifact=baseline,
            with_skill_artifact=with_skill,
            artifact_contract=contract,
            requirements=PackageRequirements(companion_files=True, script_execution=True),
            hosts=hosts,
            script_checks=scripts,
            safety_checks=safety,
            installed_root=installed_root,
            manifest=manifest,
        )
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    demo()
