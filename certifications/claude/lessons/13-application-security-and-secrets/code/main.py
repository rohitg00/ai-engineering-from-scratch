"""Companion code for:
certifications/claude/lessons/13-application-security-and-secrets/docs/en.md
It separates untrusted model intent from deterministic authorization.
Controls follow official Anthropic safety guidance and OWASP LLM concepts.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse


SECRET_PATH_PATTERNS = (".env", "credentials", "id_rsa", "id_ed25519", "secrets")
DESTRUCTIVE_COMMANDS = ("rm -rf", "git reset --hard", "drop table", "truncate table")
SECRET_VALUE_PATTERN = re.compile(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*([^\s,;]+)")


@dataclass(frozen=True)
class Action:
    tool: str
    arguments: dict[str, Any]
    source_trust: str = "user"
    approved: bool = False


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    controls: tuple[str, ...] = field(default_factory=tuple)


class PolicyGate:
    """Evaluate high-risk capabilities before a tool handler sees them."""

    def __init__(self, allowed_roots: list[str], allowed_hosts: list[str]) -> None:
        self.allowed_roots = tuple(os.path.realpath(path) for path in allowed_roots)
        self.allowed_hosts = frozenset(allowed_hosts)

    def evaluate(self, action: Action) -> Decision:
        if action.source_trust not in {"user", "trusted_system", "untrusted_content"}:
            return Decision(False, "unknown trust label", ("fail_closed",))
        if action.tool == "read_file":
            return self._read_file(action)
        if action.tool == "run_command":
            return self._run_command(action)
        if action.tool == "http_get":
            return self._http_get(action)
        if action.tool in {"write_file", "send_message", "deploy"}:
            if action.source_trust == "untrusted_content":
                return Decision(False, "untrusted content cannot authorize mutation", ("trust_boundary", "human_approval"))
            if not action.approved:
                return Decision(False, "mutation requires explicit approval", ("human_approval",))
            return Decision(True, "approved mutation", ("audit_log", "scope_check"))
        return Decision(False, "tool is not on the capability allowlist", ("allowlist",))

    def _read_file(self, action: Action) -> Decision:
        path = action.arguments.get("path")
        if not isinstance(path, str):
            return Decision(False, "path must be a string", ("schema_validation",))
        real = os.path.realpath(path)
        name = real.lower()
        if any(pattern in name for pattern in SECRET_PATH_PATTERNS):
            return Decision(False, "secret-bearing path is denied", ("secret_isolation",))
        in_root = any(real == root or real.startswith(root + os.sep) for root in self.allowed_roots)
        if not in_root:
            return Decision(False, "path is outside allowed roots", ("filesystem_sandbox",))
        return Decision(True, "read is scoped to an allowed root", ("read_only", "audit_log"))

    def _run_command(self, action: Action) -> Decision:
        command = action.arguments.get("command")
        if not isinstance(command, str):
            return Decision(False, "command must be a string", ("schema_validation",))
        normalized = command.lower()
        if any(marker in normalized for marker in DESTRUCTIVE_COMMANDS):
            return Decision(False, "destructive command is denied", ("command_denylist", "fail_closed"))
        if action.source_trust == "untrusted_content":
            return Decision(False, "untrusted content cannot select shell commands", ("trust_boundary",))
        if not action.approved:
            return Decision(False, "shell execution requires approval", ("human_approval", "sandbox"))
        return Decision(True, "approved non-destructive command", ("sandbox", "timeout", "audit_log"))

    def _http_get(self, action: Action) -> Decision:
        url = action.arguments.get("url")
        if not isinstance(url, str):
            return Decision(False, "url must be a string", ("schema_validation",))
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in self.allowed_hosts:
            return Decision(False, "network destination is not allowed", ("network_allowlist",))
        return Decision(True, "read-only request to allowed host", ("network_allowlist", "response_size_limit"))


def redact(value: str) -> str:
    """Remove common secret assignments before a string reaches logs."""
    return SECRET_VALUE_PATTERN.sub(lambda match: f"{match.group(1)}=[REDACTED]", value)


class EnvironmentSecrets:
    """Return secret values to trusted code without logging or serialization helpers."""

    def require(self, name: str) -> str:
        if not re.fullmatch(r"[A-Z][A-Z0-9_]+", name):
            raise ValueError("secret name must be an uppercase environment variable")
        value = os.environ.get(name)
        if not value:
            raise RuntimeError(f"required secret {name} is not configured")
        return value


def demo() -> dict[str, Any]:
    gate = PolicyGate(["/workspace/project"], ["api.example.test"])
    actions = [
        Action("read_file", {"path": "/workspace/project/README.md"}),
        Action("read_file", {"path": "/workspace/project/.env"}),
        Action("run_command", {"command": "rm -rf /workspace/project"}, approved=True),
        Action("http_get", {"url": "https://api.example.test/status"}),
    ]
    return {"decisions": [decision.__dict__ for decision in map(gate.evaluate, actions)]}


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2))
