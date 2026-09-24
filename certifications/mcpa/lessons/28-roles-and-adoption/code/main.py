"""Companion code for:
certifications/mcpa/lessons/28-roles-and-adoption/docs/en.md
Assign MCP 2026-07-28 spec requirements to the six roles behind a deployment.
Run: python3 code/main.py
Sources: MCP 2026-07-28 specification; MCP governance, SEP guidelines, and SDK tiers pages.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION) -> dict:
    body = dict(params or {})
    body["_meta"] = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


ROLES: dict[str, str] = {
    "server_author": "Server author",
    "host_client_developer": "Host and client developer",
    "platform_gateway_operator": "Platform or gateway operator",
    "security_governance_owner": "Security and governance owner",
    "registry_publisher": "Registry publisher",
    "end_user": "End user",
}

DEPLOYMENT_SHAPES: tuple[str, ...] = ("stdio", "http", "gateway")
ALL_SHAPES = frozenset(DEPLOYMENT_SHAPES)


@dataclass(frozen=True)
class Requirement:
    """One curated MUST or SHOULD, quoted exactly, with the role that owns it by deployment shape."""

    id: str
    keyword: str
    statement: str
    source: str
    shapes: frozenset[str]
    default_role: str | None
    overrides: dict[str, str] = field(default_factory=dict)

    def owner(self, shape: str) -> str | None:
        return self.overrides.get(shape, self.default_role)


REQUIREMENTS: tuple[Requirement, ...] = (
    Requirement(
        id="discover-implemented",
        keyword="MUST",
        statement="Servers MUST implement server/discover.",
        source="brief section 6",
        shapes=ALL_SHAPES,
        default_role="server_author",
    ),
    Requirement(
        id="stateless-no-connection-memory",
        keyword="MUST NOT",
        statement="A server MUST NOT rely on prior requests on the same connection for capabilities, version, or identity.",
        source="brief section 4",
        shapes=ALL_SHAPES,
        default_role="server_author",
    ),
    Requirement(
        id="lists-stable-across-connections",
        keyword="MUST NOT",
        statement="tools/list, resources/list, and prompts/list MUST NOT vary per connection or as a side effect of other requests.",
        source="brief section 4",
        shapes=ALL_SHAPES,
        default_role="server_author",
    ),
    Requirement(
        id="stdio-env-credentials",
        keyword="SHOULD NOT",
        statement="Implementations using an STDIO transport SHOULD NOT follow this specification, and instead retrieve credentials from the environment.",
        source="specification 2026-07-28, Authorization, Protocol Requirements",
        shapes=frozenset({"stdio"}),
        default_role="platform_gateway_operator",
    ),
    Requirement(
        id="http-accept-both-response-modes",
        keyword="MUST",
        statement="The response to a request is either one JSON object or an SSE stream scoped to that request; the client MUST support both.",
        source="brief section 9",
        shapes=frozenset({"http", "gateway"}),
        default_role="host_client_developer",
    ),
    Requirement(
        id="resource-indicators-required",
        keyword="MUST",
        statement="MCP clients MUST implement Resource Indicators for OAuth 2.0 as defined in RFC 8707.",
        source="specification 2026-07-28, Authorization",
        shapes=frozenset({"http", "gateway"}),
        default_role="host_client_developer",
    ),
    Requirement(
        id="origin-validation",
        keyword="MUST",
        statement="Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks.",
        source="specification 2026-07-28, Streamable HTTP transport, Security and Endpoint",
        shapes=frozenset({"http", "gateway"}),
        default_role="server_author",
        overrides={"gateway": "platform_gateway_operator"},
    ),
    Requirement(
        id="prm-implemented",
        keyword="MUST",
        statement="MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).",
        source="specification 2026-07-28, Authorization",
        shapes=frozenset({"http", "gateway"}),
        default_role="server_author",
    ),
    Requirement(
        id="token-passthrough-forbidden",
        keyword="MUST NOT",
        statement="The MCP server MUST NOT pass through the token it received from the MCP client.",
        source="specification 2026-07-28, Authorization, Security Considerations",
        shapes=frozenset({"http", "gateway"}),
        default_role="security_governance_owner",
    ),
    Requirement(
        id="human-can-deny-invocation",
        keyword="SHOULD",
        statement="A human SHOULD be able to deny invocations.",
        source="brief section 10",
        shapes=ALL_SHAPES,
        default_role="end_user",
    ),
    Requirement(
        id="npm-mcpname-matches-server-json",
        keyword="MUST",
        statement="The mcpName property MUST match the server name from server.json.",
        source="registry documentation, Package Types",
        shapes=ALL_SHAPES,
        default_role="registry_publisher",
    ),
    Requirement(
        id="error-code-allocation",
        keyword="MUST NOT",
        statement="Implementations of this revision MUST NOT emit -32002 or -32042.",
        source="brief section 5",
        shapes=ALL_SHAPES,
        default_role=None,
    ),
)


def requirements_for_shape(shape: str) -> list[Requirement]:
    if shape not in ALL_SHAPES:
        raise ValueError(f"unknown deployment shape: {shape!r}")
    return [requirement for requirement in REQUIREMENTS if shape in requirement.shapes]


def build_responsibility_matrix(shape: str) -> dict[str, Any]:
    """Assign every requirement in force for `shape` to a role, and report MUSTs with no owner."""
    applicable = requirements_for_shape(shape)
    assignments: dict[str, str | None] = {}
    gaps: list[str] = []
    for requirement in applicable:
        owner = requirement.owner(shape)
        assignments[requirement.id] = owner
        if owner is None and requirement.keyword.startswith("MUST"):
            gaps.append(requirement.id)
    return {"shape": shape, "assignments": assignments, "gaps": gaps}


def roles_covered(shape: str) -> set[str]:
    matrix = build_responsibility_matrix(shape)
    return {owner for owner in matrix["assignments"].values() if owner is not None}


def illustrative_exchange() -> list[dict]:
    """A stdio tools/call that succeeds because the operator's environment held the credential.

    The credential itself never appears in the request or the result: stdio
    implementations SHOULD NOT run the OAuth flow, so the only place a secret
    can live is the environment the platform or gateway operator configured
    before this process started.
    """
    request = make_request(1, "tools/call", {"name": "rotate_credentials", "arguments": {"system": "staging-db"}})
    result = make_result(1, content=[{"type": "text", "text": "staging-db credentials rotated"}], isError=False)
    return [request, result]


def transcript() -> list[dict]:
    return illustrative_exchange()


def demo() -> None:
    print("MCP 2026-07-28 responsibility matrix by deployment shape")
    for shape in DEPLOYMENT_SHAPES:
        matrix = build_responsibility_matrix(shape)
        print(f"\n{shape}")
        for requirement_id, owner in matrix["assignments"].items():
            label = ROLES[owner] if owner else "UNOWNED (needs an explicit name)"
            print(f"  {requirement_id:34s} -> {label}")
        if matrix["gaps"]:
            print("  gaps:", ", ".join(matrix["gaps"]))
    print("\nstdio exchange: the operator's environment supplies the credential, never the wire")
    for message in transcript():
        print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
