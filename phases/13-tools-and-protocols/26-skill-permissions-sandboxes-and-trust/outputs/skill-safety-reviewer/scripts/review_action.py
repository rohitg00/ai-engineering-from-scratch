#!/usr/bin/env python3
"""Classify a JSON action request under a JSON policy without executing it."""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
from pathlib import Path
from urllib.parse import urlparse


DESTRUCTIVE = {"rm", "rmdir", "sudo", "chmod", "chown", "mkfs", "dd"}
METACHARS = {";", "&&", "||", "|", ">", ">>", "<", "`"}
SECRET_PATTERNS = (
    re.compile(r"(?i)\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*\S+"),
    re.compile(r"(?i)\bauthorization\s*:\s*bearer\s+\S+"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
)
HOST_LABEL_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def contains_secret(value: str) -> bool:
    return any(pattern.search(value) for pattern in SECRET_PATTERNS)


def normalize_https_origin(value: str, *, origin_only: bool = False) -> str:
    """Return a canonical HTTPS origin with an explicit effective port."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("HTTPS origin must be a non-empty string")
    try:
        parsed = urlparse(value)
    except ValueError as error:
        raise ValueError("HTTPS origin is malformed") from error
    if (
        parsed.scheme.lower() != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("URL must use HTTPS, contain a host, and omit userinfo")
    if origin_only and (
        parsed.path not in {"", "/"} or parsed.params or parsed.query or parsed.fragment
    ):
        raise ValueError("allowlist entries must be HTTPS origins without path, query, or fragment")

    hostname = parsed.hostname.rstrip(".").lower()
    if not hostname or "%" in hostname:
        raise ValueError("HTTPS origin contains an invalid host")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        try:
            hostname = hostname.encode("idna").decode("ascii")
        except UnicodeError as error:
            raise ValueError("HTTPS origin contains an invalid host") from error
        labels = hostname.split(".")
        if len(hostname) > 253 or any(
            not HOST_LABEL_PATTERN.fullmatch(label) for label in labels
        ):
            raise ValueError("HTTPS origin contains an invalid host")
        origin_host = hostname
    else:
        origin_host = address.compressed
        if address.version == 6:
            origin_host = f"[{origin_host}]"
    try:
        port = parsed.port or 443
    except ValueError as error:
        raise ValueError("HTTPS origin contains an invalid port") from error
    return f"https://{origin_host}:{port}"


def strict_bool(mapping: dict[str, object], key: str, default: bool = False) -> bool:
    value = mapping.get(key, default)
    if not isinstance(value, bool):
        raise ValueError(f"{key} must be a JSON boolean")
    return value


def inside(root: Path, target: str) -> tuple[bool, str]:
    resolved_root = root.resolve()
    raw = Path(target)
    candidate = raw if raw.is_absolute() else resolved_root / raw
    resolved = candidate.resolve(strict=False)
    allowed = resolved == resolved_root or resolved_root in resolved.parents
    return allowed and not candidate.is_symlink(), str(resolved)


def review(policy: dict[str, object], request: dict[str, object], policy_dir: Path) -> dict[str, object]:
    kind = str(request.get("kind", ""))
    result: dict[str, object] = {
        "verdict": "deny",
        "rule": "kind-allowlist",
        "reason": "action kind is not allowed",
        "executed": False,
        "claimedPermissionsIgnored": bool(request.get("claimedPermissions")),
    }
    try:
        approved = strict_bool(request, "approved")
        influenced_by_untrusted = strict_bool(
            request, "influencedByUntrustedContent"
        )
        permit_secret_after_approval = strict_bool(
            policy, "permitSecretUseAfterApproval"
        )
    except ValueError as error:
        result.update(rule="boolean-shape", reason=str(error))
        return result
    if kind == "policy-change":
        result.update(
            rule="authority-boundary",
            reason="request content cannot modify the host permission model",
        )
        return result
    allowed_kinds = policy.get("allowedKinds", [])
    if not isinstance(allowed_kinds, list) or kind not in allowed_kinds:
        return result
    approval_kinds = policy.get("approvalKinds", [])
    if not isinstance(approval_kinds, list) or not all(
        isinstance(value, str) for value in approval_kinds
    ):
        result.update(
            rule="policy-shape",
            reason="approvalKinds must be an array of strings",
        )
        return result
    if kind in {"read", "write", "delete"}:
        target = request.get("target")
        if not isinstance(target, str):
            result.update(rule="path-required", reason="filesystem target is required")
            return result
        configured_root = Path(str(policy.get("workspaceRoot", ".")))
        root = configured_root if configured_root.is_absolute() else policy_dir / configured_root
        allowed, normalized = inside(root, target)
        result["normalizedTarget"] = normalized
        if not allowed:
            result.update(rule="workspace-jail", reason="target resolves outside workspace or through a symlink")
            return result
    if kind == "command":
        command = request.get("command", [])
        allowlist = policy.get("commandAllowlist", [])
        if not isinstance(command, list) or not command:
            result.update(rule="command-review", reason="command must be a non-empty argv array")
            return result
        executable = str(command[0])
        if Path(executable).name != executable or "/" in executable or "\\" in executable:
            result.update(rule="command-review", reason="command must use an allowlisted bare executable name")
            return result
        if executable in DESTRUCTIVE or any(str(token) in METACHARS for token in command):
            result.update(rule="command-review", reason="destructive executable or shell metacharacter denied")
            return result
        if executable == "git" and len(command) > 1 and command[1] in {"clean", "reset"}:
            result.update(rule="command-review", reason="destructive git subcommand denied")
            return result
        if not all(isinstance(token, str) for token in command):
            result.update(rule="command-review", reason="every argv item must be a string")
            return result
        if not isinstance(allowlist, list) or not all(
            isinstance(prefix, list)
            and prefix
            and all(isinstance(token, str) for token in prefix)
            for prefix in allowlist
        ):
            result.update(rule="policy-shape", reason="commandAllowlist must contain argv-prefix arrays")
            return result
        if not any(command[: len(prefix)] == prefix for prefix in allowlist):
            result.update(rule="command-review", reason="command does not match an approved argv prefix")
            return result
    if kind == "network":
        allowlist = policy.get("networkAllowlist", [])
        try:
            requested_origin = normalize_https_origin(request.get("url", ""))
        except ValueError as error:
            result.update(rule="network-shape", reason=str(error))
            return result
        result["normalizedOrigin"] = requested_origin
        if not isinstance(allowlist, list) or not all(
            isinstance(origin, str) for origin in allowlist
        ):
            result.update(
                rule="network-policy-shape",
                reason="networkAllowlist must be an array of HTTPS origins",
            )
            return result
        try:
            allowed_origins = {
                normalize_https_origin(origin, origin_only=True)
                for origin in allowlist
            }
        except ValueError as error:
            result.update(rule="network-policy-shape", reason=str(error))
            return result
        if requested_origin not in allowed_origins:
            result.update(
                rule="network-allowlist",
                reason=f"HTTPS origin {requested_origin!r} is not allowlisted",
            )
            return result
    payload = str(request.get("payload", ""))
    command_text = " ".join(str(token) for token in request.get("command", []))
    if contains_secret(payload) or contains_secret(command_text):
        if not (permit_secret_after_approval and approved):
            result.update(
                verdict="require-approval" if permit_secret_after_approval else "deny",
                rule="secret-review",
                reason="possible secret material requires an explicit approved path",
            )
            return result
    untrusted_stateful = influenced_by_untrusted and kind in {
        "write",
        "delete",
        "command",
        "network",
    }
    policy_gated = kind in approval_kinds
    if (untrusted_stateful or policy_gated) and not approved:
        reason = (
            "untrusted external content influenced a stateful request"
            if untrusted_stateful
            else "host policy requires approval"
        )
        result.update(verdict="require-approval", rule="approval-gate", reason=reason)
        return result
    result.update(verdict="allow", rule="policy-allow", reason="request satisfies the supplied policy")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--request", type=Path, required=True)
    args = parser.parse_args()
    policy = json.loads(args.policy.read_text(encoding="utf-8"))
    request = json.loads(args.request.read_text(encoding="utf-8"))
    print(json.dumps(review(policy, request, args.policy.resolve().parent), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
