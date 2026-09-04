"""Stateless MCP server, registry metadata, policy, and audit simulation.

This stdlib-only model keeps two discovery layers separate:

* ``server.json`` describes installation and remote transport metadata to a
  registry.
* ``server/discover`` reports live protocol versions and capabilities.

It does not open a network listener, validate a real OAuth token, call OPA, or
publish to a registry. Run with ``python3 code/main.py`` from the lesson root.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from typing import Callable


PROTOCOL_VERSION = "2026-07-28"
REGISTRY_SCHEMA = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
PUBLISHER_DOMAIN = "example.com"
SERVER_NAME_RE = re.compile(r"^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$")
DOMAIN_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
REMOTE_URL_RE = re.compile(r"^https?://\S+$")
VERSION_RANGE_RE = re.compile(r"(?:^[~^<>=]|[*]|(?:^|\.)x(?:$|\.))", re.IGNORECASE)


def request_meta() -> dict:
    return {
        "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "registry-capstone-client",
            "version": "1.0.0",
        },
    }


def error(code: int, message: str, data: dict | None = None) -> dict:
    detail = {"code": code, "message": message}
    if data is not None:
        detail["data"] = data
    return {"error": detail}


def validate_meta(meta: object) -> dict | None:
    if not isinstance(meta, dict):
        return error(-32602, "params._meta must be an object")
    requested = meta.get("io.modelcontextprotocol/protocolVersion")
    if not isinstance(requested, str):
        return error(-32602, "protocolVersion must be a string")
    if requested != PROTOCOL_VERSION:
        return error(
            -32022,
            "Unsupported protocol version",
            {"supported": [PROTOCOL_VERSION], "requested": requested},
        )
    if not isinstance(meta.get("io.modelcontextprotocol/clientCapabilities"), dict):
        return error(-32602, "clientCapabilities must be an object")
    return None


@dataclass(frozen=True)
class ToolSchema:
    name: str
    required_scope: str
    destructive: bool
    description: str
    input_schema: dict


Handler = Callable[[dict], dict]


@dataclass
class MCPServer:
    name: str
    title: str
    description: str
    version: str
    url: str
    trusted_issuer: str
    tools: dict[str, ToolSchema] = field(default_factory=dict)
    handlers: dict[str, Handler] = field(default_factory=dict)

    @property
    def server_info(self) -> dict:
        return {"name": self.name, "version": self.version}

    def register(self, schema: ToolSchema, handler: Handler) -> None:
        if schema.name in self.tools:
            raise ValueError(f"duplicate tool: {schema.name}")
        self.tools[schema.name] = schema
        self.handlers[schema.name] = handler

    def result(self, **fields: object) -> dict:
        return {
            "resultType": "complete",
            **fields,
            "_meta": {"io.modelcontextprotocol/serverInfo": self.server_info},
        }

    def discover(self, meta: dict) -> dict:
        invalid = validate_meta(meta)
        if invalid:
            return invalid
        return self.result(
            supportedVersions=[PROTOCOL_VERSION],
            capabilities={"tools": {"listChanged": False}},
            ttlMs=3_600_000,
            cacheScope="public",
        )

    def tools_list(self, meta: dict) -> dict:
        invalid = validate_meta(meta)
        if invalid:
            return invalid
        tools = [
            {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema,
                "annotations": {
                    "readOnlyHint": not tool.destructive,
                    "destructiveHint": tool.destructive,
                },
            }
            for tool in sorted(self.tools.values(), key=lambda item: item.name)
        ]
        return self.result(tools=tools, ttlMs=60_000, cacheScope="private")

    def registry_document(self) -> dict:
        return {
            "$schema": REGISTRY_SCHEMA,
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "version": self.version,
            "remotes": [{"type": "streamable-http", "url": self.url}],
        }


@dataclass(frozen=True)
class Token:
    user: str
    issuer: str
    audience: str
    scopes: frozenset[str]
    expires_at: float

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes

    def is_expired(self, now: float) -> bool:
        return now >= self.expires_at


def arguments_digest(args: dict) -> str:
    normalized = json.dumps(
        args,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ApprovalRecord:
    actor: str
    tool: str
    arguments_digest: str
    target: str
    expires_at: float

    @classmethod
    def for_action(
        cls,
        actor: str,
        tool: str,
        args: dict,
        target: str,
        expires_at: float,
    ) -> ApprovalRecord:
        return cls(actor, tool, arguments_digest(args), target, expires_at)

    def authorize(
        self,
        actor: str,
        tool: str,
        args: dict,
        target: str,
        now: float,
    ) -> tuple[bool, str]:
        if self.actor != actor:
            return False, "approval actor does not match token subject"
        if self.tool != tool:
            return False, "approval tool does not match requested tool"
        if self.target != target:
            return False, "approval target does not match this server"
        if self.arguments_digest != arguments_digest(args):
            return False, "approval arguments do not match requested action"
        if now >= self.expires_at:
            return False, "approval has expired"
        return True, "ok"


def policy_decide(
    server: MCPServer,
    tool: str,
    token: Token,
    args: dict,
    now: float,
    approval: ApprovalRecord | None = None,
) -> tuple[bool, str]:
    if token.issuer != server.trusted_issuer:
        return False, "token issuer is not trusted by this server"
    if token.audience != server.url:
        return False, "token audience does not match this server"
    if token.is_expired(now):
        return False, "token has expired"
    schema = server.tools.get(tool)
    if schema is None:
        return False, f"no such tool: {tool}"
    if not token.has_scope(schema.required_scope):
        return False, f"missing scope: {schema.required_scope}"
    if len(json.dumps(args)) > 8192:
        return False, "payload too large"
    if schema.destructive:
        if approval is None:
            return False, "destructive tool requires an action-bound approval"
        approved, reason = approval.authorize(
            token.user,
            tool,
            args,
            server.url,
            now,
        )
        if not approved:
            return False, reason
    return True, "ok"


def redact(payload: dict) -> dict:
    text = json.dumps(payload)
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[email]", text)
    text = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[ssn]", text)
    return json.loads(text)


@dataclass(frozen=True)
class AuditEntry:
    ts: float
    user: str
    issuer: str
    tool: str
    outcome: str
    args_redacted: dict
    response_redacted: dict


def dispatch(
    server: MCPServer,
    token: Token,
    tool: str,
    args: dict,
    meta: dict,
    audit: list[AuditEntry],
    approval: ApprovalRecord | None = None,
) -> dict:
    invalid = validate_meta(meta)
    if invalid:
        return invalid
    now = time.time()
    allowed, reason = policy_decide(server, tool, token, args, now, approval)
    if not allowed:
        audit.append(
            AuditEntry(now, token.user, token.issuer, tool, f"denied:{reason}", redact(args), {})
        )
        return error(-32000, reason)
    try:
        response = server.handlers[tool](args)
    except Exception as exc:
        audit.append(
            AuditEntry(now, token.user, token.issuer, tool, "handler_error", redact(args), {})
        )
        return server.result(
            content=[{"type": "text", "text": str(exc)}],
            isError=True,
        )
    audit.append(
        AuditEntry(
            now,
            token.user,
            token.issuer,
            tool,
            "allowed",
            redact(args),
            redact(response),
        )
    )
    return server.result(
        content=[{"type": "text", "text": json.dumps(response)}],
        structuredContent=response,
        isError=False,
    )


def validate_registry_document(document: object) -> list[str]:
    """Validate the official fields used by this lesson's remote-only profile.

    This dependency-free subset is not a replacement for validation against
    the complete pinned Registry JSON Schema before publication.
    """
    if not isinstance(document, dict):
        return ["server.json must be an object"]
    issues: list[str] = []

    for key in ("name", "description", "version"):
        if key not in document:
            issues.append(f"missing {key}")

    schema_uri = document.get("$schema")
    if "$schema" in document and schema_uri != REGISTRY_SCHEMA:
        issues.append("unsupported registry schema")

    name = document.get("name")
    if "name" in document and (
        not isinstance(name, str)
        or not 3 <= len(name) <= 200
        or SERVER_NAME_RE.fullmatch(name) is None
    ):
        issues.append("name must match namespace/server and be 3-200 characters")

    description = document.get("description")
    if "description" in document and (
        not isinstance(description, str) or not 1 <= len(description) <= 100
    ):
        issues.append("description must be a 1-100 character string")

    title = document.get("title")
    if "title" in document and (
        not isinstance(title, str) or not 1 <= len(title) <= 100
    ):
        issues.append("title must be a 1-100 character string")

    version = document.get("version")
    if "version" in document and (
        not isinstance(version, str)
        or not 1 <= len(version) <= 255
        or VERSION_RANGE_RE.search(version) is not None
        or version.casefold() == "latest"
    ):
        issues.append("version must be one concrete 1-255 character version")

    remotes = document.get("remotes")
    if not isinstance(remotes, list) or not remotes:
        issues.append("remote profile requires a non-empty remotes list")
    else:
        for index, remote in enumerate(remotes):
            if not isinstance(remote, dict):
                issues.append(f"remotes[{index}] must be an object")
                continue
            if remote.get("type") not in {"streamable-http", "sse"}:
                issues.append(f"remotes[{index}].type must be streamable-http or sse")
            remote_url = remote.get("url")
            if not isinstance(remote_url, str) or REMOTE_URL_RE.fullmatch(remote_url) is None:
                issues.append(f"remotes[{index}].url must be an http(s) URL template")
    return issues


def reverse_dns_namespace(domain: str) -> str:
    normalized = domain.casefold().rstrip(".")
    labels = normalized.split(".")
    if len(labels) < 2 or any(DOMAIN_LABEL_RE.fullmatch(label) is None for label in labels):
        raise ValueError("publisher domain must be a valid multi-label DNS name")
    return ".".join(reversed(labels))


def validate_publisher_namespace(document: object, verified_domain: str) -> list[str]:
    """Check domain ownership outside the server.json shape contract."""
    if not isinstance(document, dict) or not isinstance(document.get("name"), str):
        return []
    namespace = document["name"].partition("/")[0]
    expected = reverse_dns_namespace(verified_domain)
    if namespace != expected and not namespace.startswith(f"{expected}."):
        return [
            f"name namespace must be {expected} or its child for verified domain {verified_domain}"
        ]
    return []


def validate_runtime_alignment(document: dict, discovery: object) -> list[str]:
    """Compare publication identity with the live server/discover identity."""
    if not isinstance(discovery, dict):
        return ["server/discover result must be an object"]
    meta = discovery.get("_meta")
    server_info = (
        meta.get("io.modelcontextprotocol/serverInfo") if isinstance(meta, dict) else None
    )
    if not isinstance(server_info, dict):
        return ["server/discover must include serverInfo for registry drift checks"]

    issues: list[str] = []
    if server_info.get("name") != document.get("name"):
        issues.append("runtime serverInfo.name does not match server.json name")
    if server_info.get("version") != document.get("version"):
        issues.append("runtime serverInfo.version does not match server.json version")
    return issues


@dataclass
class Registry:
    publisher_domain: str = PUBLISHER_DOMAIN
    entries: dict[str, dict] = field(default_factory=dict)
    runtime_discovery: dict[str, dict] = field(default_factory=dict)

    def register(self, server: MCPServer) -> None:
        document = server.registry_document()
        issues = validate_registry_document(document)
        issues.extend(validate_publisher_namespace(document, self.publisher_domain))
        if issues:
            raise ValueError("; ".join(issues))
        discovery = server.discover(request_meta())
        if "error" in discovery:
            raise ValueError("runtime discovery failed")
        alignment_issues = validate_runtime_alignment(document, discovery)
        if alignment_issues:
            raise ValueError("; ".join(alignment_issues))
        self.entries[server.name] = deepcopy(document)
        self.runtime_discovery[server.name] = deepcopy(discovery)

    def search(self, query: str) -> list[str]:
        needle = query.casefold()
        return sorted(
            name
            for name, entry in self.entries.items()
            if needle in name.casefold()
            or needle in entry["title"].casefold()
            or needle in entry["description"].casefold()
        )


def build_readonly_server() -> MCPServer:
    server = MCPServer(
        name="com.example/internal-readonly",
        title="Internal Read-Only Tools",
        description="Read-only incident and data lookup tools.",
        version="1.0.0",
        url="https://mcp.internal.example.com/readonly",
        trusted_issuer="https://auth.internal.example.com",
    )
    server.register(
        ToolSchema(
            "postgres.readonly",
            "postgres:query:readonly",
            False,
            "Run an approved read-only query.",
            {
                "type": "object",
                "properties": {"sql": {"type": "string"}},
                "required": ["sql"],
                "additionalProperties": False,
            },
        ),
        lambda args: {"rows": [[1]], "sql": args["sql"]},
    )
    server.register(
        ToolSchema(
            "s3.list",
            "s3:list",
            False,
            "List objects in one approved bucket.",
            {
                "type": "object",
                "properties": {"bucket": {"type": "string"}},
                "required": ["bucket"],
                "additionalProperties": False,
            },
        ),
        lambda args: {"bucket": args["bucket"], "objects": ["a/b.txt"]},
    )
    return server


def build_destructive_server() -> MCPServer:
    server = MCPServer(
        name="com.example/internal-destructive",
        title="Internal Destructive Tools",
        description="State-changing tools behind explicit approval.",
        version="1.0.0",
        url="https://mcp.internal.example.com/destructive",
        trusted_issuer="https://auth.internal.example.com",
    )
    server.register(
        ToolSchema(
            "jira.create",
            "jira:write",
            True,
            "Create one Jira issue after explicit approval.",
            {
                "type": "object",
                "properties": {"title": {"type": "string"}},
                "required": ["title"],
                "additionalProperties": False,
            },
        ),
        lambda args: {"id": "PROJ-99", "title": args["title"], "created": True},
    )
    return server


def main() -> None:
    readonly = build_readonly_server()
    destructive = build_destructive_server()
    registry = Registry()
    registry.register(readonly)
    registry.register(destructive)
    audit: list[AuditEntry] = []

    readonly_token = Token(
        "u42",
        readonly.trusted_issuer,
        readonly.url,
        frozenset({"postgres:query:readonly", "s3:list"}),
        time.time() + 3_600,
    )
    approved_token = Token(
        "u42",
        destructive.trusted_issuer,
        destructive.url,
        frozenset({"jira:write"}),
        time.time() + 3_600,
    )
    approved_args = {"title": "new bug"}
    approval = ApprovalRecord.for_action(
        approved_token.user,
        "jira.create",
        approved_args,
        destructive.url,
        time.time() + 900,
    )

    print("=== registry metadata and runtime discovery ===")
    print(json.dumps(registry.entries[readonly.name], indent=2))
    print(json.dumps(registry.runtime_discovery[readonly.name], indent=2))
    print("tools:", json.dumps(readonly.tools_list(request_meta()), indent=2))

    print("\n=== policy-gated calls ===")
    print(
        dispatch(
            readonly,
            readonly_token,
            "postgres.readonly",
            {"sql": "SELECT 1"},
            request_meta(),
            audit,
        )
    )
    print(
        dispatch(
            destructive,
            approved_token,
            "jira.create",
            approved_args,
            request_meta(),
            audit,
            approval,
        )
    )

    print("\n=== audit log ===")
    for entry in audit:
        print(json.dumps(asdict(entry), sort_keys=True))


if __name__ == "__main__":
    main()
