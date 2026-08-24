"""Companion code for docs/en.md: admit, pin, monitor, and roll back MCP servers.
Protocol contract: https://modelcontextprotocol.io/specification/2026-07-28/server/discover
Registry contract: https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md
Run `python3 main.py` for the finite demo or `python3 -m unittest discover -s tests`.
"""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.parse import unquote, urlparse, urlunparse


PROTOCOL_VERSION = "2026-07-28"
PUBLISHER_META_KEY = "io.modelcontextprotocol.registry/publisher-provided"
OFFICIAL_META_KEY = "io.modelcontextprotocol.registry/official"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def namespace_for_domain(domain: str) -> str:
    labels = [label.lower() for label in domain.strip().strip(".").split(".") if label]
    if len(labels) < 2:
        raise ValueError("a verified namespace domain needs at least two labels")
    return ".".join(reversed(labels))


def namespace_matches(server_name: str, verified_namespace: str) -> bool:
    prefix, separator, slug = server_name.partition("/")
    return separator == "/" and bool(slug) and prefix == verified_namespace


def normalized_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(tools, key=lambda item: (str(item.get("name", "")), canonical_json(item)))


def registry_status(api_meta: dict[str, Any]) -> str:
    official = api_meta.get(OFFICIAL_META_KEY) if isinstance(api_meta, dict) else None
    return str(official.get("status", "")) if isinstance(official, dict) else ""


def is_sha256_digest(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(
        character in "0123456789abcdefABCDEF" for character in value
    )


def normalize_https_remote_url(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    decoded = unquote(value)
    if any(
        character.isspace() or ord(character) < 0x20 or ord(character) == 0x7F
        for character in value + decoded
    ):
        return None
    try:
        parsed = urlparse(value)
        hostname = parsed.hostname
        username = parsed.username
        password = parsed.password
        port = parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme != "https"
        or not isinstance(hostname, str)
        or not hostname
        or username is not None
        or password is not None
        or parsed.fragment
    ):
        return None
    normalized_host = hostname.lower()
    if ":" in normalized_host:
        normalized_host = f"[{normalized_host}]"
    else:
        try:
            normalized_host = normalized_host.encode("idna").decode("ascii")
        except UnicodeError:
            return None
    netloc = normalized_host
    if port is not None and port != 443:
        netloc = f"{netloc}:{port}"
    return urlunparse(
        ("https", netloc, parsed.path or "/", parsed.params, parsed.query, "")
    )


def is_valid_https_remote_url(value: Any) -> bool:
    return normalize_https_remote_url(value) is not None


def reported_server_info(live: Any) -> dict[str, Any] | None:
    if not isinstance(live, dict):
        return None
    metadata = live.get("_meta")
    value = metadata.get(SERVER_INFO_KEY) if isinstance(metadata, dict) else None
    return deepcopy(value) if isinstance(value, dict) else None


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reasons: tuple[str, ...]
    pin: dict[str, Any] | None = None


class AdmissionLedger:
    def __init__(self, clock: Callable[[], str] | None = None) -> None:
        self.entries: list[dict[str, Any]] = []
        self.clock = clock or (
            lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        )

    def append(
        self,
        event: str,
        server_name: str,
        version: str,
        outcome: str,
        reasons: list[str],
        evidence: dict[str, Any],
    ) -> dict[str, Any]:
        body = {
            "sequence": len(self.entries) + 1,
            "time": self.clock(),
            "event": event,
            "server": server_name,
            "version": version,
            "outcome": outcome,
            "reasons": list(reasons),
            "evidence": deepcopy(evidence),
            "previousHash": self.entries[-1]["entryHash"] if self.entries else "GENESIS",
        }
        entry = {**body, "entryHash": digest(body)}
        self.entries.append(entry)
        return entry

    def verify(self) -> bool:
        previous_hash = "GENESIS"
        for expected_sequence, entry in enumerate(self.entries, start=1):
            body = {key: value for key, value in entry.items() if key != "entryHash"}
            if entry.get("sequence") != expected_sequence:
                return False
            if entry.get("previousHash") != previous_hash:
                return False
            if entry.get("entryHash") != digest(body):
                return False
            previous_hash = entry["entryHash"]
        return True


class RegistryAdmissionController:
    def __init__(
        self,
        required_capabilities: tuple[str, ...] = ("tools",),
        clock: Callable[[], str] | None = None,
    ) -> None:
        self.required_capabilities = required_capabilities
        self.ledger = AdmissionLedger(clock)
        self.pins: dict[tuple[str, str], dict[str, Any]] = {}
        self.active: dict[str, str] = {}

    def _record_errors(self, record: Any) -> list[str]:
        if not isinstance(record, dict):
            return ["record must be an object"]
        errors: list[str] = []
        for field in ("name", "version", "description"):
            if not isinstance(record.get(field), str) or not record[field].strip():
                errors.append(f"record.{field} must be a non-empty string")

        packages = record.get("packages")
        remotes = record.get("remotes")
        if not (isinstance(packages, list) and packages) and not (
            isinstance(remotes, list) and remotes
        ):
            errors.append("record must declare at least one package or remote")
        if packages is not None and not isinstance(packages, list):
            errors.append("record.packages must be an array")
        elif isinstance(packages, list):
            for index, package in enumerate(packages):
                if not isinstance(package, dict):
                    errors.append(f"record.packages[{index}] must be an object")
                    continue
                for field in ("registryType", "identifier", "version"):
                    if not isinstance(package.get(field), str) or not package[field].strip():
                        errors.append(
                            f"record.packages[{index}].{field} must be a non-empty string"
                        )
                transport = package.get("transport")
                if not isinstance(transport, dict) or not isinstance(
                    transport.get("type"), str
                ) or not transport["type"].strip():
                    errors.append(
                        f"record.packages[{index}].transport.type must be a non-empty string"
                    )
        if remotes is not None and not isinstance(remotes, list):
            errors.append("record.remotes must be an array")
        elif isinstance(remotes, list):
            for index, remote in enumerate(remotes):
                if not isinstance(remote, dict):
                    errors.append(f"record.remotes[{index}] must be an object")
                    continue
                if remote.get("type") not in {"streamable-http", "sse"}:
                    errors.append(
                        f"record.remotes[{index}].type must be streamable-http or sse"
                    )
                url = remote.get("url")
                if not is_valid_https_remote_url(url):
                    errors.append(f"record.remotes[{index}].url must be an HTTPS URL")

        metadata = record.get("_meta", {})
        if not isinstance(metadata, dict):
            errors.append("record._meta must be an object")
        elif set(metadata) - {PUBLISHER_META_KEY}:
            errors.append("record._meta contains a non-publisher key")
        return errors

    def _source_errors(
        self,
        record: dict[str, Any],
        provenance_evidence: dict[str, Any],
    ) -> tuple[list[str], dict[str, Any] | None]:
        if not isinstance(record, dict) or not isinstance(provenance_evidence, dict):
            return ["provenance evidence must be an object"], None
        kind = provenance_evidence.get("kind", "package")
        if kind == "remote":
            remotes = record.get("remotes", [])
            candidates = [item for item in remotes if isinstance(item, dict)] if isinstance(remotes, list) else []
            evidence_url = normalize_https_remote_url(provenance_evidence.get("url"))
            remote = next(
                (
                    item
                    for item in candidates
                    if evidence_url is not None
                    and normalize_https_remote_url(item.get("url")) == evidence_url
                ),
                None,
            )
            errors: list[str] = []
            if remote is None:
                errors.append("verified remote endpoint is absent from the registry record")
                return errors, None
            if remote.get("type") != provenance_evidence.get("transportType"):
                errors.append("verified remote transport does not match the registry record")
            if provenance_evidence.get("verified") is not True:
                errors.append("remote ownership or provenance is not verified")
            if not is_sha256_digest(provenance_evidence.get("digest")):
                errors.append("remote evidence digest is not a SHA-256 digest")
            source = deepcopy({"kind": "remote", **remote})
            source["url"] = evidence_url
            return errors, source
        if kind != "package":
            return [f"unknown provenance evidence kind: {kind}"], None

        packages = record.get("packages", [])
        candidates = [item for item in packages if isinstance(item, dict)] if isinstance(packages, list) else []
        package = next(
            (
                item
                for item in candidates
                if item.get("identifier") == provenance_evidence.get("identifier")
            ),
            None,
        )
        errors: list[str] = []
        if package is None:
            errors.append("verified package identifier is absent from the registry record")
            return errors, None
        if package.get("registryType") != provenance_evidence.get("registryType"):
            errors.append("verified package registry type does not match the registry record")
        transport = package.get("transport")
        transport_type = transport.get("type") if isinstance(transport, dict) else None
        if transport_type != provenance_evidence.get("transportType"):
            errors.append("verified package transport does not match the registry record")
        if provenance_evidence.get("verified") is not True:
            errors.append("package ownership or provenance is not verified")
        if package.get("version") != provenance_evidence.get("version"):
            errors.append("verified package version does not match the registry record")
        if not is_sha256_digest(provenance_evidence.get("digest")):
            errors.append("package evidence digest is not a SHA-256 digest")
        return errors, deepcopy({"kind": "package", **package})

    def _live_errors(self, live: Any) -> list[str]:
        if not isinstance(live, dict):
            return ["live discovery result must be an object"]
        errors: list[str] = []
        supported_versions = live.get("supportedVersions")
        if not isinstance(supported_versions, list) or any(
            not isinstance(version, str) for version in supported_versions
        ):
            errors.append("live supportedVersions must be an array of strings")
        elif PROTOCOL_VERSION not in supported_versions:
            errors.append(f"live server does not advertise {PROTOCOL_VERSION}")
        capabilities = live.get("capabilities", {})
        if not isinstance(capabilities, dict):
            errors.append("live capabilities must be an object")
        else:
            for capability in self.required_capabilities:
                if capability not in capabilities:
                    errors.append(f"live server is missing capability: {capability}")
        tools = live.get("tools")
        if not isinstance(tools, list):
            errors.append("live tool descriptors are missing")
        else:
            for index, tool in enumerate(tools):
                if not isinstance(tool, dict):
                    errors.append(f"live tools[{index}] must be an object")
                    continue
                if not isinstance(tool.get("name"), str) or not tool["name"].strip():
                    errors.append(f"live tools[{index}] needs a non-empty name")
                if not isinstance(tool.get("description"), str) or not tool["description"].strip():
                    errors.append(f"live tools[{index}] needs a non-empty description")
                if not isinstance(tool.get("inputSchema"), dict):
                    errors.append(f"live tools[{index}] needs an inputSchema object")
        return errors

    def admit(
        self,
        record: dict[str, Any],
        api_meta: dict[str, Any],
        verified_namespace: str,
        provenance_evidence: dict[str, Any],
        live: Any,
        registry_source: str = "https://registry.modelcontextprotocol.io",
    ) -> Decision:
        name = str(record.get("name", "<missing>")) if isinstance(record, dict) else "<missing>"
        version = str(record.get("version", "<missing>")) if isinstance(record, dict) else "<missing>"
        reasons = self._record_errors(record)
        status = registry_status(api_meta)
        if status != "active":
            reasons.append(f"registry status is {status or 'missing'}, not active")
        if not namespace_matches(name, verified_namespace):
            reasons.append("server name is outside the verified namespace")
        source_errors, source = self._source_errors(record, provenance_evidence)
        reasons.extend(source_errors)
        reasons.extend(self._live_errors(live))

        evidence = {
            "recordDigest": digest(record),
            "registrySource": registry_source,
            "status": status,
            "verifiedNamespace": verified_namespace,
        }
        if reasons:
            self.ledger.append("admission", name, version, "rejected", reasons, evidence)
            return Decision(False, tuple(reasons))

        assert source is not None
        provenance = {
            "registrySource": registry_source,
            "server": name,
            "registryVersion": version,
            "recordDigest": evidence["recordDigest"],
            "source": source,
            "sourceDigest": provenance_evidence["digest"],
        }
        pin = {
            "server": name,
            "version": version,
            "registryStatus": status,
            "recordDigest": evidence["recordDigest"],
            "source": source,
            "sourceDigest": provenance_evidence["digest"],
            "toolsetDigest": digest(normalized_tools(live["tools"])),
            "provenanceDigest": digest(provenance),
            "reportedServerInfo": reported_server_info(live),
            "quarantined": False,
        }
        self.pins[(name, version)] = deepcopy(pin)
        self.active[name] = version
        self.ledger.append("admission", name, version, "approved", [], pin)
        return Decision(True, (), deepcopy(pin))

    def check_live(self, server_name: str, version: str, live: Any) -> Decision:
        pin = self.pins.get((server_name, version))
        if pin is None:
            return Decision(False, ("version has no admission pin",))
        reasons = self._live_errors(live)
        tools = live.get("tools") if isinstance(live, dict) else None
        tools_valid = isinstance(tools, list) and all(isinstance(tool, dict) for tool in tools)
        observed_toolset = digest(normalized_tools(tools)) if tools_valid else None
        if tools_valid and observed_toolset != pin["toolsetDigest"]:
            reasons.append("live tool descriptors differ from the admitted pin")
        if pin["quarantined"]:
            reasons.append("version is quarantined")
        if reasons:
            pin["quarantined"] = True
            if self.active.get(server_name) == version:
                self.active.pop(server_name)
        outcome = "healthy" if not reasons else "drifted"
        self.ledger.append(
            "live-check",
            server_name,
            version,
            outcome,
            reasons,
            {"pin": pin["provenanceDigest"], "observedToolset": observed_toolset},
        )
        return Decision(not reasons, tuple(reasons), deepcopy(pin))

    def observe_registry_status(self, server_name: str, version: str, status: str) -> None:
        pin = self.pins.get((server_name, version))
        reasons: list[str] = []
        outcome = "observed"
        if pin is None:
            reasons.append("status refers to an unadmitted version")
            outcome = "ignored"
        else:
            pin["registryStatus"] = status
            if status != "active":
                pin["quarantined"] = True
                outcome = "quarantined"
                reasons.append(f"registry status changed to {status}")
                if self.active.get(server_name) == version:
                    self.active.pop(server_name)
        self.ledger.append(
            "registry-status", server_name, version, outcome, reasons, {"status": status}
        )

    def rollback(self, server_name: str, target_version: str, reason: str) -> Decision:
        pin = self.pins.get((server_name, target_version))
        reasons: list[str] = []
        if pin is None:
            reasons.append("rollback target has no admission pin")
        elif pin["quarantined"] or pin["registryStatus"] != "active":
            reasons.append("rollback target is not eligible or is quarantined")
        if reasons:
            self.ledger.append(
                "rollback", server_name, target_version, "rejected", reasons, {"reason": reason}
            )
            return Decision(False, tuple(reasons))
        previous = self.active.get(server_name)
        self.active[server_name] = target_version
        evidence = {"from": previous, "to": target_version, "reason": reason}
        self.ledger.append("rollback", server_name, target_version, "activated", [], evidence)
        return Decision(True, (), deepcopy(pin))


def sample_record(version: str) -> dict[str, Any]:
    return {
        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        "name": "com.example/inventory",
        "version": version,
        "description": "Read-only inventory lookup tools",
        "packages": [
            {
                "registryType": "pypi",
                "identifier": "example-mcp-inventory",
                "version": version,
                "transport": {"type": "stdio"},
            }
        ],
        "_meta": {PUBLISHER_META_KEY: {"tier": "internal-approved"}},
    }


def sample_live(version: str, extra_tool: bool = False) -> dict[str, Any]:
    tools = [
        {
            "name": "inventory_get",
            "description": "Fetch one inventory item",
            "inputSchema": {
                "type": "object",
                "properties": {"sku": {"type": "string"}},
                "required": ["sku"],
            },
        }
    ]
    if extra_tool:
        tools.append(
            {
                "name": "inventory_delete",
                "description": "Delete one inventory item",
                "inputSchema": {"type": "object"},
            }
        )
    return {
        "resultType": "complete",
        "supportedVersions": [PROTOCOL_VERSION],
        "capabilities": {"tools": {"listChanged": False}},
        "tools": tools,
        "_meta": {
            SERVER_INFO_KEY: {"name": "com.example/inventory", "version": version}
        },
    }


def evidence_for(version: str) -> dict[str, Any]:
    return {
        "kind": "package",
        "registryType": "pypi",
        "identifier": "example-mcp-inventory",
        "version": version,
        "transportType": "stdio",
        "digest": digest({"wheel": f"example-mcp-inventory-{version}.whl"}),
        "verified": True,
    }


def demo() -> None:
    ticks = iter(f"2026-08-21T10:00:0{second}+00:00" for second in range(9))
    controller = RegistryAdmissionController(clock=lambda: next(ticks))
    active_meta = {OFFICIAL_META_KEY: {"status": "active"}}

    first = controller.admit(
        sample_record("1.0.0"),
        active_meta,
        namespace_for_domain("example.com"),
        evidence_for("1.0.0"),
        sample_live("1.0.0"),
    )
    second = controller.admit(
        sample_record("1.1.0"),
        active_meta,
        namespace_for_domain("example.com"),
        evidence_for("1.1.0"),
        sample_live("1.1.0"),
    )
    drift = controller.check_live("com.example/inventory", "1.1.0", sample_live("1.1.0", True))
    controller.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
    rollback = controller.rollback("com.example/inventory", "1.0.0", "unexpected delete tool")

    report = {
        "admitted": [first.allowed, second.allowed],
        "driftAllowed": drift.allowed,
        "driftReasons": drift.reasons,
        "rollbackAllowed": rollback.allowed,
        "activeVersion": controller.active["com.example/inventory"],
        "ledgerEntries": len(controller.ledger.entries),
        "ledgerValid": controller.ledger.verify(),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    demo()
