"""Companion code for docs/en.md: an evidence ledger for binary analysis.
Record model: rea 6.5.0 `src/domain/evidence.ts`, `src/domain/residualUnknown.ts`,
`src/domain/analysisSnapshot.ts` (tag rea-agents-6.5.0, commit 3b79af28e80785afce9f5998d8f03289402a1847).
Run `python3 main.py` for the finite demo or `python3 -m unittest discover -s tests`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import platform
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
FIXTURES = HERE / "fixtures"
OBJECT_PATH = FIXTURES / "ledger-x86_64-O1.o"
SOURCE_PATH = FIXTURES / "ledger.c"
HARNESS_PATH = FIXTURES / "harness.c"
REA_EVIDENCE_FILES = ("rea-evidence-percent-change.json", "rea-evidence-grade.json")
REA_SNAPSHOT_PATH = FIXTURES / "rea-snapshot.json"
RUN_EVIDENCE_PATH = FIXTURES / "run-evidence.json"

CONFIDENCES = ("observed", "derived", "inferred")
AUTHORITIES = (
    "shipped-artifact",
    "controlled-replay",
    "historical-reference",
    "external-service",
    "analyst-inference",
)
ISOLATIONS = ("none", "process", "container", "virtual-machine")
LOCATION_KINDS = ("address", "address-range", "artifact-path", "file-offset", "file-offset-range")
UNKNOWN_STATUSES = ("open", "investigating", "blocked", "contradicted", "resolved")
SEVERITIES = ("low", "medium", "high", "critical")
DISPOSITIONS = ("verified", "withdrawn", "out-of-scope")
CLAIM_STATUSES = ("pass", "fail", "unsupported", "unknown")
EVIDENCE_ID_RE = re.compile(r"^ev_[0-9a-f]{64}$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
RECORD_KEYS = {
    "evidence_id",
    "subject",
    "provider",
    "analysis_profile",
    "predicate_type",
    "operation",
    "parameters",
    "raw_result",
    "normalized_result",
    "confidence",
    "authority",
    "environment",
    "limitations",
    "locations",
    "evidence_links",
}
NO_SUBJECT_LIMITATION = "The subject artifact is unknown for this observation."
REPLAY_LIMITATION = "Loaded from a local snapshot; this call did not re-run the provider."
MUTATION_LIMITATION = "A registry mutation records what the analyst decided. It is not proof of the answer."
HOST_BUILD_LIMITATION = (
    "The run executed a host build of ledger.c, not the x86-64 object. "
    "The claim about the object rests on the shared source and on the compiler."
)
ONE_INPUT_LIMITATION = "One run observes one input. It proves nothing about other inputs."
CACHE_FORMAT_VERSION = "course-answer-cache-1"
CACHE_ENTRY_CEILING = 1000
REGISTRY_PROVIDER = {"id": "course-unknown-registry", "name": "course unknown registry", "version": "1"}
ELF_READER_PROVIDER = {"id": "course-elf-reader", "name": "lesson 35 ELF reader", "version": "1"}
SOURCE_READER_PROVIDER = {"id": "course-source-reader", "name": "lesson 35 source reader", "version": "1"}
MODEL_PROVIDER = {"id": "course-byte-model", "name": "lesson 35 byte pattern model", "version": "1"}
PREDICTION_PROVIDER = {"id": "course-analyst", "name": "lesson 35 analyst prediction", "version": "1"}
PREDICTION_LIMITATION = "A prediction is the analyst's reading of derived facts. It records an expectation, not a behaviour."
SHT_RELA = 4
STT_FUNC = 2
R_X86_64_PC32 = 2


class EvidenceError(ValueError):
    pass


class EvidenceIntegrityError(EvidenceError):
    pass


class ClaimError(EvidenceError):
    pass


class CacheError(EvidenceError):
    pass


def check_json_value(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, (bool, int, str)):
        return
    if isinstance(value, float):
        raise EvidenceError(f"{path}: floats are not allowed in ledger records")
    if isinstance(value, list):
        for index, item in enumerate(value):
            check_json_value(item, f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise EvidenceError(f"{path}: object keys must be strings")
            check_json_value(item, f"{path}.{key}")
        return
    raise EvidenceError(f"{path}: {type(value).__name__} is not a JSON value")


def canonical_json(value: Any) -> str:
    check_json_value(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def digest_canonical(value: Any) -> str:
    return sha256_hex(canonical_json(value))


def profile_digest(provider: dict[str, Any], parameters: dict[str, Any]) -> str:
    return digest_canonical({"provider": provider, "parameters": parameters})


def make_profile(provider: dict[str, Any], parameters: dict[str, Any]) -> dict[str, Any]:
    return {"provider": provider, "parameters": parameters, "digest": profile_digest(provider, parameters)}


def semantic_projection(record: dict[str, Any]) -> dict[str, Any]:
    subject = record["subject"]
    projection: dict[str, Any] = {
        "subject": None
        if subject is None
        else {
            "digest": subject["digest"],
            "format": subject["format"],
            "architecture": subject["architecture"],
        },
        "provider": record["provider"],
        "analysis_profile": record["analysis_profile"],
        "predicate_type": record["predicate_type"],
        "operation": record["operation"],
        "parameters": record["parameters"],
        "raw_result": record["raw_result"],
        "normalized_result": record["normalized_result"],
        "confidence": record["confidence"],
        "authority": record["authority"],
        "environment": record["environment"],
        "limitations": record["limitations"],
    }
    if record.get("relationship_coverage") is not None:
        projection["relationship_coverage"] = record["relationship_coverage"]
    projection["locations"] = record["locations"]
    projection["evidence_links"] = record["evidence_links"]
    return projection


def compute_evidence_id(record: dict[str, Any]) -> str:
    return "ev_" + digest_canonical(semantic_projection(record))


def subject_for_file(path: Path, fmt: str, architecture: str | None) -> dict[str, Any]:
    return {
        "name": path.name,
        "digest": {"sha256": sha256_hex(path.read_bytes())},
        "format": fmt,
        "architecture": architecture,
        "local_path": str(path),
    }


def create_evidence(
    subject: dict[str, Any] | None,
    provider: dict[str, Any],
    *,
    operation: str,
    parameters: dict[str, Any],
    normalized_result: Any,
    confidence: str = "observed",
    authority: str = "shipped-artifact",
    limitations: tuple[str, ...] | list[str] = (),
    locations: tuple[dict[str, Any], ...] | list[dict[str, Any]] = (),
    evidence_links: tuple[str, ...] | list[str] = (),
    analysis_profile: dict[str, Any] | None = None,
    raw_result: Any = None,
    environment: dict[str, Any] | None = None,
    predicate_type: str = "rea.analysis",
) -> dict[str, Any]:
    limits = list(limitations)
    if subject is None and NO_SUBJECT_LIMITATION not in limits:
        limits.append(NO_SUBJECT_LIMITATION)
    record = {
        "subject": subject,
        "provider": provider,
        "analysis_profile": analysis_profile,
        "predicate_type": predicate_type,
        "operation": operation,
        "parameters": parameters,
        "raw_result": raw_result,
        "normalized_result": normalized_result,
        "confidence": confidence,
        "authority": authority,
        "environment": environment,
        "limitations": limits,
        "locations": list(locations),
        "evidence_links": sorted(set(evidence_links)),
    }
    record["evidence_id"] = compute_evidence_id(record)
    return validate_evidence(record)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise EvidenceError(message)


def validate_subject(subject: Any) -> None:
    if subject is None:
        return
    _require(isinstance(subject, dict), "subject must be an object or null")
    _require(set(subject) == {"name", "digest", "format", "architecture", "local_path"}, "subject has wrong keys")
    _require(isinstance(subject["name"], str) and subject["name"] != "", "subject.name must be non-empty")
    digest = subject["digest"]
    _require(isinstance(digest, dict) and set(digest) == {"sha256"}, "subject.digest must hold sha256")
    _require(isinstance(digest["sha256"], str) and SHA256_RE.match(digest["sha256"]) is not None, "subject sha256 malformed")
    _require(isinstance(subject["format"], str) and subject["format"] != "", "subject.format must be non-empty")
    _require(subject["architecture"] is None or isinstance(subject["architecture"], str), "subject.architecture malformed")
    _require(isinstance(subject["local_path"], str), "subject.local_path must be a string")


def validate_provider(provider: Any, where: str) -> None:
    _require(isinstance(provider, dict) and set(provider) == {"id", "name", "version"}, f"{where} must hold id, name, version")
    _require(isinstance(provider["id"], str) and provider["id"] != "", f"{where}.id must be non-empty")
    _require(isinstance(provider["name"], str) and provider["name"] != "", f"{where}.name must be non-empty")
    _require(provider["version"] is None or isinstance(provider["version"], str), f"{where}.version malformed")


def validate_evidence(record: Any) -> dict[str, Any]:
    _require(isinstance(record, dict), "evidence must be an object")
    keys = set(record)
    _require(keys == RECORD_KEYS or keys == RECORD_KEYS | {"relationship_coverage"}, f"evidence keys mismatch: {sorted(keys ^ RECORD_KEYS)}")
    check_json_value(record)
    validate_subject(record["subject"])
    validate_provider(record["provider"], "provider")
    profile = record["analysis_profile"]
    if profile is not None:
        _require(isinstance(profile, dict) and set(profile) == {"provider", "parameters", "digest"}, "analysis_profile has wrong keys")
        validate_provider(profile["provider"], "analysis_profile.provider")
        _require(isinstance(profile["provider"]["version"], str) and profile["provider"]["version"] != "", "analysis_profile.provider.version must be non-empty")
        if profile["provider"] != record["provider"]:
            raise EvidenceIntegrityError("Analysis profile provider does not match Evidence provider")
        if profile["digest"] != profile_digest(profile["provider"], profile["parameters"]):
            raise EvidenceIntegrityError("Analysis profile digest does not match its parameters")
    _require(isinstance(record["predicate_type"], str) and record["predicate_type"] != "", "predicate_type must be non-empty")
    _require(isinstance(record["operation"], str) and record["operation"] != "", "operation must be non-empty")
    _require(isinstance(record["parameters"], dict), "parameters must be an object")
    _require(record["confidence"] in CONFIDENCES, f"confidence must be one of {CONFIDENCES}")
    _require(record["authority"] in AUTHORITIES, f"authority must be one of {AUTHORITIES}")
    environment = record["environment"]
    if environment is not None:
        _require(isinstance(environment, dict) and set(environment) == {"id", "platform", "architecture", "isolation"}, "environment has wrong keys")
        _require(environment["isolation"] in ISOLATIONS, f"environment.isolation must be one of {ISOLATIONS}")
    _require(isinstance(record["limitations"], list) and all(isinstance(item, str) and item for item in record["limitations"]), "limitations must be non-empty strings")
    _require(isinstance(record["locations"], list), "locations must be a list")
    for location in record["locations"]:
        _require(isinstance(location, dict) and location.get("kind") in LOCATION_KINDS, f"location kind must be one of {LOCATION_KINDS}")
    links = record["evidence_links"]
    _require(isinstance(links, list) and all(isinstance(item, str) and EVIDENCE_ID_RE.match(item) for item in links), "evidence_links must be ev_ ids")
    if record["evidence_id"] != compute_evidence_id(record):
        raise EvidenceIntegrityError("Evidence semantic identifier does not match its record")
    return record


def rebind_subject_path(record: dict[str, Any], path: str, sha256: str, fmt: str, architecture: str | None) -> dict[str, Any]:
    subject = record["subject"]
    if subject is None:
        return record
    if subject["digest"]["sha256"] != sha256 or subject["format"] != fmt or subject["architecture"] != architecture:
        raise EvidenceIntegrityError("Cannot rebind evidence to a target with a different identity")
    rebound = dict(record)
    rebound["subject"] = dict(subject, name=Path(path).name or "artifact", local_path=path)
    return validate_evidence(rebound)


def load_evidence_file(path: Path) -> dict[str, Any]:
    return validate_evidence(json.loads(path.read_text(encoding="utf-8")))


def unknown_id_for(question: str, domain: str, scope_digest: str | None) -> str:
    return "unk_" + digest_canonical(
        {"domain": domain.strip(), "question": " ".join(question.split()), "scope_digest": scope_digest}
    )


def revision_digest(revision: dict[str, Any]) -> str:
    semantic = {key: value for key, value in revision.items() if key != "revision_digest"}
    return digest_canonical(semantic)


def validate_unknown(revision: Any) -> dict[str, Any]:
    _require(isinstance(revision, dict), "unknown must be an object")
    check_json_value(revision)
    for key in (
        "unknown_id",
        "revision",
        "previous_revision_digest",
        "revision_digest",
        "scope_digest",
        "question",
        "status",
        "severity",
        "domain",
        "supporting_evidence_ids",
        "contradicting_evidence_ids",
        "required_authority",
        "required_confidence",
        "required_environment",
        "recommended_probes",
        "resolution",
        "mutation_evidence_ids",
    ):
        _require(key in revision, f"unknown is missing {key}")
    _require(isinstance(revision["question"], str) and revision["question"].strip() != "", "question must be non-empty")
    _require(revision["status"] in UNKNOWN_STATUSES, f"status must be one of {UNKNOWN_STATUSES}")
    _require(revision["severity"] in SEVERITIES, f"severity must be one of {SEVERITIES}")
    _require(revision["required_confidence"] in CONFIDENCES, "required_confidence malformed")
    _require(revision["required_authority"] is None or revision["required_authority"] in AUTHORITIES, "required_authority malformed")
    _require(isinstance(revision["revision"], int) and revision["revision"] >= 1, "revision must be a positive integer")
    expected_id = unknown_id_for(revision["question"], revision["domain"], revision["scope_digest"])
    if revision["unknown_id"] != expected_id:
        raise EvidenceIntegrityError("Residual unknown ID does not match its immutable identity")
    if (revision["revision"] == 1) != (revision["previous_revision_digest"] is None):
        raise EvidenceIntegrityError("Only the first revision has no predecessor")
    if (revision["status"] == "resolved") != (revision["resolution"] is not None):
        raise EvidenceIntegrityError("Only resolved unknowns carry a resolution")
    if revision["status"] == "contradicted" and not revision["contradicting_evidence_ids"]:
        raise EvidenceIntegrityError("Contradicted status requires contradicting evidence")
    both = set(revision["supporting_evidence_ids"]) & set(revision["contradicting_evidence_ids"])
    if both:
        raise EvidenceIntegrityError("Evidence cannot simultaneously support and contradict")
    resolution = revision["resolution"]
    if resolution is not None:
        _require(resolution.get("disposition") in DISPOSITIONS, "resolution.disposition malformed")
        if resolution["disposition"] == "verified":
            _require(len(resolution.get("evidence_ids", [])) >= 1, "a verified resolution needs evidence ids")
    _require(len(revision["mutation_evidence_ids"]) >= 1, "every revision names the mutation evidence that made it")
    if revision["revision_digest"] != revision_digest(revision):
        raise EvidenceIntegrityError("Residual unknown revision digest does not match its record")
    return revision


class EvidenceLedger:
    def __init__(self) -> None:
        self.records: dict[str, dict[str, Any]] = {}
        self.unknowns: dict[str, list[dict[str, Any]]] = {}

    def record(self, record: dict[str, Any]) -> str:
        validate_evidence(record)
        existing = self.records.get(record["evidence_id"])
        if existing is not None:
            if semantic_projection(existing) == semantic_projection(record):
                return "duplicate"
            raise EvidenceIntegrityError("Conflicting evidence record")
        self.records[record["evidence_id"]] = record
        return "recorded"

    def get(self, evidence_id: str) -> dict[str, Any]:
        if evidence_id not in self.records:
            raise EvidenceError(f"missing evidence {evidence_id}")
        return self.records[evidence_id]

    def find(self, **criteria: Any) -> list[dict[str, Any]]:
        matches = []
        for record in self.records.values():
            if all(record.get(key) == value for key, value in criteria.items()):
                matches.append(record)
        return sorted(matches, key=lambda item: item["evidence_id"])

    def dangling_links(self) -> list[str]:
        missing = set()
        for record in self.records.values():
            for link in record["evidence_links"]:
                if link not in self.records:
                    missing.add(link)
        return sorted(missing)

    def current_unknown(self, unknown_id: str) -> dict[str, Any]:
        if unknown_id not in self.unknowns:
            raise EvidenceError("not-found")
        return self.unknowns[unknown_id][-1]

    def verify_unknown_chain(self, unknown_id: str) -> int:
        revisions = self.unknowns.get(unknown_id)
        if not revisions:
            raise EvidenceError("not-found")
        previous = None
        for index, revision in enumerate(revisions, start=1):
            validate_unknown(revision)
            if revision["revision"] != index:
                raise EvidenceIntegrityError("Revision numbers must increase by one")
            if revision["previous_revision_digest"] != previous:
                raise EvidenceIntegrityError("Revision chain is broken")
            for mutation_id in revision["mutation_evidence_ids"]:
                if mutation_id not in self.records:
                    raise EvidenceIntegrityError("Mutation evidence is missing from the ledger")
            previous = revision["revision_digest"]
        return len(revisions)

    def _mutation_evidence(self, operation: str, parameters: dict[str, Any], result: dict[str, Any]) -> str:
        record = create_evidence(
            None,
            REGISTRY_PROVIDER,
            operation=operation,
            parameters=parameters,
            normalized_result=result,
            confidence="derived",
            authority="analyst-inference",
            limitations=[MUTATION_LIMITATION],
            predicate_type="course.residual-unknown-mutation",
        )
        self.record(record)
        return record["evidence_id"]

    def open_unknown(
        self,
        question: str,
        *,
        domain: str,
        scope_digest: str | None,
        severity: str,
        required_confidence: str = "observed",
        required_authority: str | None = None,
        required_environment: dict[str, Any] | None = None,
        recommended_probes: list[dict[str, str]] | tuple[dict[str, str], ...] = (),
        supporting_evidence_ids: list[str] | tuple[str, ...] = (),
    ) -> dict[str, Any]:
        unknown_id = unknown_id_for(question, domain, scope_digest)
        if unknown_id in self.unknowns:
            raise EvidenceError("already-exists")
        for evidence_id in supporting_evidence_ids:
            self.get(evidence_id)
        parameters = {"question": question, "domain": domain, "scope_digest": scope_digest, "severity": severity}
        mutation_id = self._mutation_evidence("record_unknown", parameters, {"unknown_id": unknown_id, "revision": 1, "status": "open"})
        revision = {
            "unknown_id": unknown_id,
            "revision": 1,
            "previous_revision_digest": None,
            "scope_digest": scope_digest,
            "question": question,
            "status": "open",
            "severity": severity,
            "domain": domain,
            "supporting_evidence_ids": sorted(set(supporting_evidence_ids)),
            "contradicting_evidence_ids": [],
            "required_authority": required_authority,
            "required_confidence": required_confidence,
            "required_environment": required_environment,
            "recommended_probes": list(recommended_probes),
            "resolution": None,
            "mutation_evidence_ids": [mutation_id],
        }
        revision["revision_digest"] = revision_digest(revision)
        validate_unknown(revision)
        self.unknowns[unknown_id] = [revision]
        return revision

    def update_unknown(self, unknown_id: str, expected_revision: int, **changes: Any) -> dict[str, Any]:
        current = self.current_unknown(unknown_id)
        if current["revision"] != expected_revision:
            raise EvidenceError("revision-conflict")
        allowed = {
            "status",
            "severity",
            "supporting_evidence_ids",
            "contradicting_evidence_ids",
            "recommended_probes",
            "resolution",
            "required_authority",
            "required_confidence",
            "required_environment",
        }
        unexpected = set(changes) - allowed
        if unexpected:
            raise EvidenceError(f"cannot change {sorted(unexpected)}")
        for key in ("supporting_evidence_ids", "contradicting_evidence_ids"):
            for evidence_id in changes.get(key, []):
                self.get(evidence_id)
        resolution = changes.get("resolution")
        if resolution is not None and resolution.get("disposition") == "verified":
            self._check_verifying_evidence(current, resolution.get("evidence_ids", []))
        mutation_id = self._mutation_evidence(
            "update_unknown",
            {"unknown_id": unknown_id, "expected_revision": expected_revision, "changes": changes},
            {"unknown_id": unknown_id, "revision": expected_revision + 1, "status": changes.get("status", current["status"])},
        )
        revision = dict(current)
        revision.update(changes)
        for key in ("supporting_evidence_ids", "contradicting_evidence_ids"):
            if key in changes:
                revision[key] = sorted(set(changes[key]))
        revision["revision"] = expected_revision + 1
        revision["previous_revision_digest"] = current["revision_digest"]
        revision["mutation_evidence_ids"] = [mutation_id]
        revision["revision_digest"] = revision_digest(revision)
        validate_unknown(revision)
        self.unknowns[unknown_id].append(revision)
        return revision

    def _check_verifying_evidence(self, unknown: dict[str, Any], evidence_ids: list[str]) -> None:
        if not evidence_ids:
            raise EvidenceError("a verified resolution needs at least one observed evidence id")
        for evidence_id in evidence_ids:
            record = self.get(evidence_id)
            if record["confidence"] != unknown["required_confidence"]:
                raise EvidenceError(f"{evidence_id} is {record['confidence']}; the unknown requires {unknown['required_confidence']} evidence")
            if unknown["required_authority"] is not None and record["authority"] != unknown["required_authority"]:
                raise EvidenceError(f"{evidence_id} has authority {record['authority']}; the unknown requires {unknown['required_authority']}")

    def resolve_unknown(self, unknown_id: str, expected_revision: int, evidence_ids: list[str], rationale: str) -> dict[str, Any]:
        return self.update_unknown(
            unknown_id,
            expected_revision,
            status="resolved",
            supporting_evidence_ids=sorted(set(self.current_unknown(unknown_id)["supporting_evidence_ids"]) | set(evidence_ids)),
            resolution={"disposition": "verified", "rationale": rationale, "evidence_ids": sorted(set(evidence_ids))},
        )

    def export_bundle(self) -> dict[str, Any]:
        artifacts: dict[str, dict[str, Any]] = {}
        providers: dict[str, dict[str, Any]] = {}
        environments: dict[str, dict[str, Any]] = {}
        for record in self.records.values():
            subject = record["subject"]
            if subject is not None:
                artifacts[subject["digest"]["sha256"]] = {
                    "digest": subject["digest"],
                    "format": subject["format"],
                    "architecture": subject["architecture"],
                }
            providers[canonical_json(record["provider"])] = record["provider"]
            if record["environment"] is not None:
                environments[canonical_json(record["environment"])] = record["environment"]
        unknowns = [revision for revisions in self.unknowns.values() for revision in revisions]
        return {
            "artifacts": [artifacts[key] for key in sorted(artifacts)],
            "providers": [providers[key] for key in sorted(providers)],
            "environments": [environments[key] for key in sorted(environments)],
            "scenarios": [],
            "captures": [],
            "unknowns": sorted(unknowns, key=lambda item: (item["unknown_id"], item["revision"])),
            "records": [self.records[key] for key in sorted(self.records)],
        }

    def import_bundle(self, bundle: dict[str, Any]) -> dict[str, int]:
        _require(isinstance(bundle, dict) and isinstance(bundle.get("records"), list), "bundle must hold a records list")
        staged_records: dict[str, dict[str, Any]] = {}
        for record in bundle["records"]:
            validate_evidence(record)
            existing = self.records.get(record["evidence_id"]) or staged_records.get(record["evidence_id"])
            if existing is not None and semantic_projection(existing) != semantic_projection(record):
                raise EvidenceIntegrityError("Conflicting evidence record")
            staged_records[record["evidence_id"]] = record
        staged_unknowns: dict[str, list[dict[str, Any]]] = {}
        for revision in bundle.get("unknowns", []):
            validate_unknown(revision)
            staged_unknowns.setdefault(revision["unknown_id"], []).append(revision)
        for unknown_id, revisions in staged_unknowns.items():
            revisions.sort(key=lambda item: item["revision"])
            if unknown_id in self.unknowns and self.unknowns[unknown_id] != revisions[: len(self.unknowns[unknown_id])]:
                raise EvidenceIntegrityError("Conflicting unknown revision")
            previous = None
            for index, revision in enumerate(revisions, start=1):
                if revision["revision"] != index or revision["previous_revision_digest"] != previous:
                    raise EvidenceIntegrityError("Revision chain is broken")
                previous = revision["revision_digest"]
        added = 0
        for evidence_id, record in staged_records.items():
            if evidence_id not in self.records:
                self.records[evidence_id] = record
                added += 1
        for unknown_id, revisions in staged_unknowns.items():
            self.unknowns[unknown_id] = revisions
        return {"records": added, "duplicates": len(staged_records) - added, "unknowns": len(staged_unknowns)}


@dataclass
class Claim:
    claim_id: str
    text: str
    function: str
    cases: list[tuple[list[Any], Any]]
    basis: list[str] = field(default_factory=list)
    prediction_id: str | None = None


def record_prediction(ledger: EvidenceLedger, claim: Claim, subject: dict[str, Any]) -> dict[str, Any]:
    record = create_evidence(
        subject,
        PREDICTION_PROVIDER,
        operation="predict_result",
        parameters={"function": claim.function, "cases": [{"args": args, "expected": expected} for args, expected in claim.cases]},
        normalized_result={"claim_id": claim.claim_id, "text": claim.text},
        confidence="inferred",
        authority="analyst-inference",
        evidence_links=claim.basis,
        limitations=[PREDICTION_LIMITATION],
    )
    ledger.record(record)
    claim.prediction_id = record["evidence_id"]
    return record


def run_records_for(ledger: EvidenceLedger, function: str, args: list[Any]) -> list[dict[str, Any]]:
    matches = []
    for record in ledger.find(operation="execute_function"):
        parameters = record["parameters"]
        if parameters.get("function") == function and parameters.get("args") == args:
            matches.append(record)
    return matches


def promote_claim(ledger: EvidenceLedger, claim: Claim, evidence_ids: list[str]) -> dict[str, Any]:
    if not evidence_ids:
        raise ClaimError(f"{claim.claim_id}: an inferred claim needs observed evidence; none was given")
    covered: set[int] = set()
    for evidence_id in evidence_ids:
        record = ledger.get(evidence_id)
        if record["confidence"] != "observed":
            raise ClaimError(f"{claim.claim_id}: {evidence_id} is {record['confidence']}; only observed evidence can promote an inferred claim")
        if record["operation"] != "execute_function":
            raise ClaimError(f"{claim.claim_id}: {evidence_id} does not record a run")
        parameters = record["parameters"]
        hit = False
        for index, (args, expected) in enumerate(claim.cases):
            if parameters.get("function") == claim.function and parameters.get("args") == args:
                hit = True
                if record["normalized_result"]["result"] != expected:
                    raise ClaimError(f"{claim.claim_id}: {evidence_id} observed {record['normalized_result']['result']!r}, the claim says {expected!r}")
                covered.add(index)
        if not hit:
            raise ClaimError(f"{claim.claim_id}: {evidence_id} does not state this claim")
    if len(covered) != len(claim.cases):
        raise ClaimError(f"{claim.claim_id}: {len(covered)} of {len(claim.cases)} inputs have observed runs")
    limitations = sorted({item for evidence_id in evidence_ids for item in ledger.get(evidence_id)["limitations"]})
    return {"claim_id": claim.claim_id, "status": "pass", "evidence_ids": sorted(set(evidence_ids)), "limitations": limitations}


def check_claim(ledger: EvidenceLedger, claim: Claim) -> dict[str, Any]:
    supporting: list[str] = []
    contradicting: list[str] = []
    covered = 0
    for args, expected in claim.cases:
        records = run_records_for(ledger, claim.function, args)
        agree = [record["evidence_id"] for record in records if record["normalized_result"]["result"] == expected]
        disagree = [record["evidence_id"] for record in records if record["normalized_result"]["result"] != expected]
        supporting.extend(agree)
        contradicting.extend(disagree)
        if agree and not disagree:
            covered += 1
    if contradicting:
        status = "fail"
    elif covered == len(claim.cases):
        status = "pass"
    elif covered == 0:
        status = "unsupported"
    else:
        status = "unknown"
    limitations = sorted({item for evidence_id in supporting + contradicting for item in ledger.get(evidence_id)["limitations"]})
    if status == "pass":
        promote_claim(ledger, claim, supporting)
    return {
        "claim_id": claim.claim_id,
        "text": claim.text,
        "status": status,
        "covered": covered,
        "total": len(claim.cases),
        "evidence_ids": sorted(set(supporting)),
        "contradicting_evidence_ids": sorted(set(contradicting)),
        "basis": list(claim.basis),
        "limitations": limitations,
    }


def completion_ledger(results: list[dict[str, Any]]) -> dict[str, Any]:
    records = [
        {"claim_id": item["claim_id"], "status": item["status"], "evidence_ids": item["evidence_ids"] or item["contradicting_evidence_ids"] or item["basis"]}
        for item in results
    ]
    summary = {status: sum(1 for item in records if item["status"] == status) for status in CLAIM_STATUSES}
    summary["total"] = len(records)
    summary["complete"] = summary["pass"] == summary["total"]
    return {"ledger_id": "ecl_" + digest_canonical({"records": records}), "records": records, "summary": summary}


class AnswerCache:
    def __init__(self, target: dict[str, Any], binding: dict[str, Any]) -> None:
        _require(set(target) >= {"sha256", "kind", "format", "architecture"}, "target needs sha256, kind, format, architecture")
        _require(set(binding) == {"provider", "analysis_profile"}, "binding needs provider and analysis_profile")
        profile = binding["analysis_profile"]
        if binding["provider"] != profile["provider"]:
            raise CacheError("Snapshot binding provider does not match analysis profile")
        if profile["digest"] != profile_digest(profile["provider"], profile["parameters"]):
            raise CacheError("Analysis profile digest does not match its parameters")
        self.target = target
        self.binding = binding
        self.entries: dict[str, dict[str, Any]] = {}
        self.invalidated: str | None = None

    def query_id(self, operation: str, parameters: dict[str, Any]) -> str:
        return "query_" + digest_canonical(
            {"target": self.target, "binding": self.binding, "operation": operation, "parameters": parameters}
        )

    def store(self, operation: str, parameters: dict[str, Any], execution: dict[str, Any]) -> str:
        if len(self.entries) >= CACHE_ENTRY_CEILING:
            raise CacheError(f"cache holds {CACHE_ENTRY_CEILING} entries; refuse to grow")
        query_id = self.query_id(operation, parameters)
        self.entries[query_id] = {"query_id": query_id, "operation": operation, "parameters": parameters, "execution": execution}
        return query_id

    def lookup(self, operation: str, parameters: dict[str, Any]) -> dict[str, Any] | None:
        entry = self.entries.get(self.query_id(operation, parameters))
        if entry is None:
            return None
        execution = json.loads(json.dumps(entry["execution"]))
        execution["limitations"] = list(execution.get("limitations", [])) + [REPLAY_LIMITATION]
        return execution

    def invalidate(self, reason: str) -> None:
        self.entries.clear()
        self.invalidated = reason

    def export_snapshot(self) -> dict[str, Any]:
        if self.invalidated is not None:
            raise CacheError(f"Analysis snapshots are unavailable because analysis metadata may have changed: {self.invalidated}")
        return {
            "format_version": CACHE_FORMAT_VERSION,
            "target": self.target,
            "binding": self.binding,
            "entries": [self.entries[key] for key in sorted(self.entries)],
        }

    def import_snapshot(self, snapshot: dict[str, Any]) -> int:
        version = snapshot.get("format_version")
        if version is not None and version != CACHE_FORMAT_VERSION:
            raise CacheError(f"format_mismatch: snapshot format {version!r} is not {CACHE_FORMAT_VERSION!r}")
        if snapshot.get("target") != self.target:
            raise CacheError("profile_mismatch: target does not match the active binary")
        binding = snapshot.get("binding")
        if binding != self.binding:
            raise CacheError("profile_mismatch: provider or analysis profile does not match the active binding")
        staged = {}
        for entry in snapshot.get("entries", []):
            expected = self.query_id(entry["operation"], entry["parameters"])
            if entry["query_id"] != expected:
                raise CacheError(f"query_id does not match its entry: {entry['query_id']}")
            staged[expected] = {
                "query_id": expected,
                "operation": entry["operation"],
                "parameters": entry["parameters"],
                "execution": entry["execution"],
            }
        if len(self.entries) + len(staged) > CACHE_ENTRY_CEILING:
            raise CacheError("import would exceed the cache ceiling")
        self.entries.update(staged)
        return len(staged)


def rea_snapshot_binding(snapshot: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    return snapshot["target"], snapshot["binding"]


def read_elf_sections(data: bytes) -> dict[str, dict[str, int]]:
    _require(data[:4] == b"\x7fELF" and data[4] == 2 and data[5] == 1, "expected a little-endian ELF64 file")
    shoff = struct.unpack_from("<Q", data, 0x28)[0]
    shentsize, shnum, shstrndx = struct.unpack_from("<HHH", data, 0x3A)
    headers = []
    for index in range(shnum):
        fields = struct.unpack_from("<IIQQQQIIQQ", data, shoff + index * shentsize)
        headers.append(
            {
                "index": index,
                "name_offset": fields[0],
                "type": fields[1],
                "offset": fields[4],
                "size": fields[5],
                "link": fields[6],
                "info": fields[7],
                "entsize": fields[9],
            }
        )
    names = headers[shstrndx]
    sections = {}
    for header in headers:
        start = names["offset"] + header["name_offset"]
        end = data.index(b"\x00", start)
        header["name"] = data[start:end].decode("ascii")
        sections[header["name"]] = header
    return sections


def read_elf_symbols(data: bytes, sections: dict[str, dict[str, int]]) -> list[dict[str, Any]]:
    symtab = sections[".symtab"]
    strtab = sections[".strtab"]
    symbols = []
    for index in range(symtab["size"] // 24):
        name_offset, info, _other, shndx, value, size = struct.unpack_from("<IBBHQQ", data, symtab["offset"] + index * 24)
        start = strtab["offset"] + name_offset
        end = data.index(b"\x00", start)
        symbols.append(
            {
                "index": index,
                "name": data[start:end].decode("ascii"),
                "type": info & 0xF,
                "section_index": shndx,
                "value": value,
                "size": size,
            }
        )
    return symbols


def read_relocations(data: bytes, sections: dict[str, dict[str, int]], name: str) -> list[dict[str, int]]:
    section = sections.get(name)
    if section is None or section["type"] != SHT_RELA:
        return []
    relocations = []
    for index in range(section["size"] // 24):
        offset, info, addend = struct.unpack_from("<QQq", data, section["offset"] + index * 24)
        relocations.append({"offset": offset, "type": info & 0xFFFFFFFF, "symbol": info >> 32, "addend": addend})
    return relocations


def observe_source(path: Path = SOURCE_PATH) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    functions = re.findall(r"^(?:const char \*|int) (\w+)\(", text, flags=re.MULTILINE)
    labels = re.findall(r'"([A-Z])"', text)
    return create_evidence(
        subject_for_file(path, "c-source", None),
        SOURCE_READER_PROVIDER,
        operation="read_source",
        parameters={},
        normalized_result={"bytes": len(text.encode("utf-8")), "functions": functions, "labels": labels},
        limitations=["The source is the file we wrote. It is not proof of what any compiled object does."],
    )


def observe_object(path: Path = OBJECT_PATH) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    data = path.read_bytes()
    sections = read_elf_sections(data)
    symbols = read_elf_symbols(data, sections)
    relocations = read_relocations(data, sections, ".rela.text")
    function_symbols = [symbol for symbol in symbols if symbol["type"] == STT_FUNC and symbol["name"]]
    subject = subject_for_file(path, "elf", "x86_64")
    text = sections[".text"]
    inspection = create_evidence(
        subject,
        ELF_READER_PROVIDER,
        operation="inspect_object",
        parameters={},
        normalized_result={
            "sections": {
                name: {"offset": header["offset"], "size": header["size"], "sha256": sha256_hex(data[header["offset"] : header["offset"] + header["size"]])}
                for name, header in sections.items()
                if name in (".text", ".rodata", ".rodata.str1.1", ".rela.text", ".rela.rodata")
            },
            "functions": [
                {"name": symbol["name"], "offset": symbol["value"], "size": symbol["size"]}
                for symbol in function_symbols
            ],
            "text_relocations": [
                {"offset": relocation["offset"], "type": relocation["type"], "symbol": symbols[relocation["symbol"]]["name"] or sections_name(sections, symbols[relocation["symbol"]]["section_index"]), "addend": relocation["addend"]}
                for relocation in relocations
            ],
        },
        locations=[{"kind": "file-offset-range", "start": text["offset"], "end": text["offset"] + text["size"]}],
        limitations=["Section bytes are read from the file on disk. The reader applies no relocation and runs no code."],
    )
    function_records = {}
    for symbol in function_symbols:
        start = text["offset"] + symbol["value"]
        chunk = data[start : start + symbol["size"]]
        function_records[symbol["name"]] = create_evidence(
            subject,
            ELF_READER_PROVIDER,
            operation="read_function_bytes",
            parameters={"function": symbol["name"]},
            normalized_result={"text_offset": symbol["value"], "size": symbol["size"], "bytes_hex": chunk.hex(), "sha256": sha256_hex(chunk)},
            locations=[{"kind": "file-offset-range", "start": start, "end": start + symbol["size"]}],
            evidence_links=[inspection["evidence_id"]],
            limitations=["These are the bytes of one symbol. Instruction boundaries are not part of this observation."],
        )
    return inspection, function_records


def sections_name(sections: dict[str, dict[str, int]], index: int) -> str:
    for name, header in sections.items():
        if header["index"] == index:
            return name
    return f"section {index}"


def find_byte_patterns(code: bytes, patterns: dict[str, bytes], function: str) -> dict[str, int]:
    found = {name: code.find(pattern) for name, pattern in patterns.items()}
    missing = [name for name, index in found.items() if index < 0]
    if missing:
        raise EvidenceError(f"{function} bytes lack the expected patterns: {missing}")
    return found


def derive_grade_model(ledger: EvidenceLedger, grade_record: dict[str, Any], inspection: dict[str, Any], path: Path = OBJECT_PATH) -> dict[str, Any]:
    data = path.read_bytes()
    code = bytes.fromhex(grade_record["normalized_result"]["bytes_hex"])
    patterns = {
        "imul_0x66666667": b"\x48\x69\xc0\x67\x66\x66\x66",
        "sar_34": b"\x48\xc1\xf9\x22",
        "add_minus_6": b"\x83\xc1\xfa",
        "cmp_4_ja": b"\x83\xf9\x04\x77",
    }
    found = find_byte_patterns(code, patterns, "grade")
    sections = read_elf_sections(data)
    text_offset = grade_record["normalized_result"]["text_offset"]
    size = grade_record["normalized_result"]["size"]
    table_relocation = None
    for relocation in inspection["normalized_result"]["text_relocations"]:
        if text_offset <= relocation["offset"] < text_offset + size and relocation["type"] == R_X86_64_PC32 and relocation["symbol"] == ".rodata":
            table_relocation = relocation
    if table_relocation is None:
        raise EvidenceError("grade has no PC32 relocation against .rodata")
    table_offset = table_relocation["addend"] + 4
    rodata = sections[".rodata"]
    entries = list(struct.unpack_from("<5I", data, rodata["offset"] + table_offset))
    model = {
        "multiplier": "0x66666667",
        "shift": 34,
        "divisor": 10,
        "first_case": 6,
        "case_count": 5,
        "table_offset_in_rodata": table_offset,
        "table": entries,
        "default": 0,
        "pattern_offsets": found,
    }
    record = create_evidence(
        grade_record["subject"],
        MODEL_PROVIDER,
        operation="derive_switch_model",
        parameters={"function": "grade"},
        normalized_result=model,
        confidence="derived",
        authority="shipped-artifact",
        evidence_links=[grade_record["evidence_id"], inspection["evidence_id"]],
        limitations=[
            "The divisor 10 is a derivation from the multiplier 0x66666667 and the shift 34. The file holds no 10.",
            "The table offset adds 4 to the relocation addend because the 4-byte displacement ends the instruction.",
        ],
    )
    ledger.record(record)
    return record


def derive_percent_change_model(ledger: EvidenceLedger, record: dict[str, Any]) -> dict[str, Any]:
    code = bytes.fromhex(record["normalized_result"]["bytes_hex"])
    patterns = {"test_edi_je": b"\x85\xff\x74", "imul_100": b"\x6b\xc6\x64", "cdq_idiv_edi": b"\x99\xf7\xff"}
    found = find_byte_patterns(code, patterns, "percent_change")
    model = {"zero_guard": True, "scale": 100, "division": "signed 32-bit, truncates toward zero", "pattern_offsets": found}
    derived = create_evidence(
        record["subject"],
        MODEL_PROVIDER,
        operation="derive_arithmetic_model",
        parameters={"function": "percent_change"},
        normalized_result=model,
        confidence="derived",
        authority="shipped-artifact",
        evidence_links=[record["evidence_id"]],
        limitations=["Byte patterns identify the instructions. The 32-bit overflow behaviour is a property of IDIV, not a value in the file."],
    )
    ledger.record(derived)
    return derived


def wrap32(value: int) -> int:
    value &= 0xFFFFFFFF
    return value - 0x100000000 if value >= 0x80000000 else value


def c_div(a: int, b: int) -> int:
    quotient = abs(a) // abs(b)
    return quotient if (a < 0) == (b < 0) else -quotient


def predict(function: str, args: list[Any], grade_model: dict[str, Any], labels: list[str]) -> Any:
    if function == "percent_change":
        before, after = args
        if before == 0:
            return 0
        return wrap32(c_div(wrap32((after - before) * 100), before))
    if function == "grade":
        index = c_div(args[0], grade_model["divisor"]) - grade_model["first_case"]
        if 0 <= index < grade_model["case_count"]:
            return grade_model["table"][index]
        return grade_model["default"]
    if function == "total":
        value = 0
        for item in args:
            value = wrap32(value + item)
        return value
    if function == "grade_label":
        return labels[predict("grade", args, grade_model, labels)]
    raise EvidenceError(f"no model for {function}")


def claim_suite(grade_model_record: dict[str, Any], percent_record: dict[str, Any], source_record: dict[str, Any]) -> list[Claim]:
    grade_model = grade_model_record["normalized_result"]
    labels = source_record["normalized_result"]["labels"]
    claims: list[Claim] = []

    def single(function: str, args: list[Any], basis: list[str]) -> None:
        expected = predict(function, args, grade_model, labels)
        rendered = ", ".join(str(item) for item in args)
        claims.append(Claim(f"{function}({rendered})", f"{function}({rendered}) == {expected!r}", function, [(args, expected)], basis))

    for args in ([12400, 15500], [0, 5], [100, 50], [-7, 3]):
        single("percent_change", args, [percent_record["evidence_id"]])
    for score in (55, 60, 69, 70, 85, 95, 100, 105, 110, -5):
        single("grade", [score], [grade_model_record["evidence_id"]])
    single("total", [1, 2, 3], [source_record["evidence_id"]])
    single("total", [], [source_record["evidence_id"]])
    single("grade_label", [85], [source_record["evidence_id"], grade_model_record["evidence_id"]])
    claims.append(
        Claim(
            "grade(90..100)",
            "grade(score) == 4 for every score from 90 to 100",
            "grade",
            [([score], 4) for score in range(90, 101)],
            [grade_model_record["evidence_id"]],
        )
    )
    return claims


def run_grid(claims: list[Claim]) -> list[tuple[str, list[Any]]]:
    grid: list[tuple[str, list[Any]]] = []
    for claim in claims:
        if len(claim.cases) != 1:
            continue
        args = claim.cases[0][0]
        if (claim.function, args) not in grid:
            grid.append((claim.function, args))
    return grid


def find_compiler() -> str | None:
    for name in ("clang", "cc", "gcc"):
        found = shutil.which(name)
        if found:
            return found
    return None


def compiler_version(compiler: str) -> str:
    completed = subprocess.run([compiler, "--version"], capture_output=True, text=True, check=False)
    first = (completed.stdout or completed.stderr).strip().splitlines()
    return first[0] if first else "unknown"


def detect_format(data: bytes) -> str:
    if data[:4] == b"\x7fELF":
        return "elf"
    if data[:4] in (b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xfe\xed\xfa\xce"):
        return "mach-o"
    if data[:2] == b"MZ":
        return "pe"
    return "raw-binary"


def build_harness(compiler: str, workdir: Path) -> Path:
    binary = workdir / "harness"
    subprocess.run([compiler, "-O1", "-I", str(FIXTURES), "-o", str(binary), str(HARNESS_PATH)], check=True, capture_output=True, text=True)
    return binary


def parse_output(text: str) -> Any:
    text = text.strip()
    try:
        return int(text)
    except ValueError:
        return text


def observe_runs(compiler: str, grid: list[tuple[str, list[Any]]], source_record: dict[str, Any]) -> list[dict[str, Any]]:
    records = []
    with tempfile.TemporaryDirectory() as temp:
        binary = build_harness(compiler, Path(temp))
        subject = subject_for_file(binary, detect_format(binary.read_bytes()), platform.machine())
        environment = {"id": "host-process", "platform": sys.platform, "architecture": platform.machine(), "isolation": "process"}
        provider = {"id": "course-harness", "name": "host compiler build of harness.c", "version": compiler_version(compiler)}
        for function, args in grid:
            completed = subprocess.run([str(binary), function, *[str(item) for item in args]], capture_output=True, text=True, check=False)
            records.append(
                create_evidence(
                    subject,
                    provider,
                    operation="execute_function",
                    parameters={"function": function, "args": args},
                    normalized_result={"result": parse_output(completed.stdout), "stdout": completed.stdout, "exit_code": completed.returncode},
                    confidence="observed",
                    authority="controlled-replay",
                    environment=environment,
                    evidence_links=[source_record["evidence_id"]],
                    limitations=[HOST_BUILD_LIMITATION, ONE_INPUT_LIMITATION],
                )
            )
    return records


def import_rea_evidence(ledger: EvidenceLedger) -> list[dict[str, Any]]:
    imported = []
    for name in REA_EVIDENCE_FILES:
        record = load_evidence_file(FIXTURES / name)
        ledger.record(record)
        imported.append(record)
    return imported


def verify_rea_snapshot(path: Path = REA_SNAPSHOT_PATH) -> dict[str, Any]:
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    target, binding = rea_snapshot_binding(snapshot)
    cache = AnswerCache(target, binding)
    count = cache.import_snapshot(snapshot)
    replay = cache.lookup("analyze_function", {"procedure": "grade"})
    stale_parameters = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
    stale_binding = {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale_parameters)}
    stale_cache = AnswerCache(target, stale_binding)
    try:
        stale_cache.import_snapshot(snapshot)
        refused = False
    except CacheError:
        refused = True
    return {
        "entries": count,
        "query_ids": [entry["query_id"] for entry in snapshot["entries"]],
        "replay_hit": replay is not None,
        "replay_limitation": REPLAY_LIMITATION in (replay or {}).get("limitations", []),
        "miss_on_other_parameters": cache.lookup("analyze_function", {"procedure": "total"}) is None,
        "stale_profile_refused": refused,
        "bundle_records": len(snapshot["evidence_bundle"]["records"]),
    }


def question_for(claim: Claim) -> str:
    return f"Does {claim.text} hold when the compiled function runs?"


def build_ledger(live_runs: bool = True, record_path: Path | None = None) -> tuple[EvidenceLedger, dict[str, Any]]:
    ledger = EvidenceLedger()
    source_record = observe_source()
    ledger.record(source_record)
    inspection, function_records = observe_object()
    ledger.record(inspection)
    for record in function_records.values():
        ledger.record(record)
    rea_records = import_rea_evidence(ledger)
    snapshot_report = verify_rea_snapshot()
    grade_model = derive_grade_model(ledger, function_records["grade"], inspection)
    percent_model = derive_percent_change_model(ledger, function_records["percent_change"])
    claims = claim_suite(grade_model, percent_model, source_record)
    scope = inspection["subject"]["digest"]["sha256"]
    opened = {}
    for claim in claims:
        record_prediction(ledger, claim, inspection["subject"])
        opened[claim.claim_id] = ledger.open_unknown(
            question_for(claim),
            domain="function-behaviour",
            scope_digest=scope,
            severity="low" if len(claim.cases) > 1 else "medium",
            required_confidence="observed",
            required_authority="controlled-replay",
            recommended_probes=[{"operation": "execute_function", "rationale": "Run the host build of harness.c with these arguments."}],
            supporting_evidence_ids=claim.basis + [claim.prediction_id],
        )
    compiler = find_compiler() if live_runs else None
    run_source = "none"
    if compiler is not None:
        runs = observe_runs(compiler, run_grid(claims), source_record)
        for record in runs:
            ledger.record(record)
        run_source = f"live: {compiler_version(compiler)}"
        if record_path is not None:
            bundle_ledger = EvidenceLedger()
            bundle_ledger.record(source_record)
            for record in runs:
                bundle_ledger.record(record)
            record_path.write_text(json.dumps(bundle_ledger.export_bundle(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    elif RUN_EVIDENCE_PATH.exists():
        counts = ledger.import_bundle(json.loads(RUN_EVIDENCE_PATH.read_text(encoding="utf-8")))
        run_source = f"imported {counts['records']} recorded run records from {RUN_EVIDENCE_PATH.name}"
    results = []
    for claim in claims:
        result = check_claim(ledger, claim)
        unknown = opened[claim.claim_id]
        if result["status"] == "pass":
            ledger.resolve_unknown(unknown["unknown_id"], unknown["revision"], result["evidence_ids"], "Observed runs agree with the prediction on every input.")
        elif result["status"] == "fail":
            ledger.update_unknown(unknown["unknown_id"], unknown["revision"], status="contradicted", contradicting_evidence_ids=result["contradicting_evidence_ids"])
        elif result["status"] == "unknown":
            ledger.update_unknown(unknown["unknown_id"], unknown["revision"], status="investigating", supporting_evidence_ids=unknown["supporting_evidence_ids"] + result["evidence_ids"])
        results.append(result)
    completion = completion_ledger(results)
    unknown_status: dict[str, int] = {}
    open_questions = []
    for revisions in ledger.unknowns.values():
        current = revisions[-1]
        unknown_status[current["status"]] = unknown_status.get(current["status"], 0) + 1
        if current["status"] != "resolved":
            open_questions.append({"unknown_id": current["unknown_id"], "status": current["status"], "revision": current["revision"], "question": current["question"]})
    report = {
        "object_sha256": scope,
        "records": len(ledger.records),
        "by_confidence": {name: len(ledger.find(confidence=name)) for name in CONFIDENCES},
        "rea_records_imported": [record["evidence_id"] for record in rea_records],
        "rea_snapshot": snapshot_report,
        "grade_table": grade_model["normalized_result"]["table"],
        "runs": run_source,
        "claims": [{"claim_id": item["claim_id"], "status": item["status"], "covered": f"{item['covered']}/{item['total']}"} for item in results],
        "completion_ledger_id": completion["ledger_id"],
        "complete": completion["summary"]["complete"],
        "unknowns": unknown_status,
        "open_questions": open_questions,
        "dangling_links": ledger.dangling_links(),
    }
    return ledger, report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path, default=None, help="write the host run records as an evidence bundle")
    parser.add_argument("--no-run", action="store_true", help="skip the host compiler and import recorded runs")
    args = parser.parse_args(argv)
    _ledger, report = build_ledger(live_runs=not args.no_run, record_path=args.record)
    print(json.dumps(report, indent=2))
    return 0 if report["complete"] or report["runs"] != "none" else 1


if __name__ == "__main__":
    sys.exit(main())
