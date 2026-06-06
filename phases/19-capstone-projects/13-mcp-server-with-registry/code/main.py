"""MCP server + registry + OPA policy gate scaffold.

The hard architectural primitives are: (a) a stateless StreamableHTTP-style
dispatch that looks up a tool, checks scopes through an OPA-style policy,
and executes with audit log enrichment; (b) a registry that pulls
.well-known/mcp-capabilities from each server and validates. This scaffold
implements a minimal in-memory version of both so the handshakes are visible.

Run:  python main.py
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Callable


# ---------------------------------------------------------------------------
# tool schema  --  typed input + required scope
# ---------------------------------------------------------------------------

@dataclass
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
    url: str
    tools: dict[str, ToolSchema] = field(default_factory=dict)
    handlers: dict[str, Handler] = field(default_factory=dict)

    def register(self, schema: ToolSchema, handler: Handler) -> None:
        self.tools[schema.name] = schema
        self.handlers[schema.name] = handler

    def capabilities(self) -> dict:
        """The .well-known/mcp-capabilities document."""
        return {
            "server": self.name,
            "transport": "streamable_http",
            "url": self.url,
            "tools": [
                {"name": t.name, "scope": t.required_scope,
                 "destructive": t.destructive,
                 "description": t.description,
                 "input_schema": t.input_schema}
                for t in self.tools.values()
            ],
        }


# ---------------------------------------------------------------------------
# OAuth-style scope set
# ---------------------------------------------------------------------------

@dataclass
class Token:
    user: str
    scopes: set[str]
    approved_at: float = 0.0      # epoch; scope_elevation freshness for destructive tools

    def has_scope(self, s: str) -> bool:
        return s in self.scopes

    def fresh_approval(self, now: float, window_s: int = 900) -> bool:
        return "approved:by:human" in self.scopes and (now - self.approved_at) <= window_s


# ---------------------------------------------------------------------------
# OPA-style policy  --  Rego-like function over (tool, token, args)
# ---------------------------------------------------------------------------

def policy_decide(server: MCPServer, tool: str, token: Token, args: dict,
                  now: float) -> tuple[bool, str]:
    if tool not in server.tools:
        return False, f"no such tool: {tool}"
    schema = server.tools[tool]
    if not token.has_scope(schema.required_scope):
        return False, f"missing scope: {schema.required_scope}"
    if schema.destructive and not token.fresh_approval(now):
        return False, "destructive tool requires fresh human approval (Slack card)"
    # payload size cap example
    if len(json.dumps(args)) > 8192:
        return False, "payload too large (> 8 KB)"
    return True, "ok"


# ---------------------------------------------------------------------------
# audit log  --  structured JSONL with PII redaction
# ---------------------------------------------------------------------------

def redact(payload: dict) -> dict:
    """Presidio-style redaction stand-in: email, SSN, phone."""
    s = json.dumps(payload)
    s = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[email]", s)
    s = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[ssn]", s)
    return json.loads(s)


@dataclass
class AuditEntry:
    ts: float
    user: str
    tool: str
    outcome: str
    args_redacted: dict
    response_redacted: dict


# ---------------------------------------------------------------------------
# dispatch  --  policy-gated tool invocation
# ---------------------------------------------------------------------------

def dispatch(server: MCPServer, token: Token, tool: str, args: dict,
             audit: list[AuditEntry]) -> dict:
    now = time.time()
    ok, reason = policy_decide(server, tool, token, args, now)
    if not ok:
        audit.append(AuditEntry(now, token.user, tool, f"denied:{reason}",
                                redact(args), {}))
        return {"error": {"code": 403, "message": reason}}
    handler = server.handlers[tool]
    try:
        result = handler(args)
        audit.append(AuditEntry(now, token.user, tool, "ok",
                                redact(args), redact(result)))
        return {"result": result}
    except Exception as exc:
        audit.append(AuditEntry(now, token.user, tool, f"error:{exc}",
                                redact(args), {}))
        return {"error": {"code": 500, "message": str(exc)}}


# ---------------------------------------------------------------------------
# registry  --  polls capabilities and validates
# ---------------------------------------------------------------------------

@dataclass
class Registry:
    entries: dict[str, dict] = field(default_factory=dict)

    def register(self, server: MCPServer) -> None:
        self.entries[server.name] = server.capabilities()

    def search(self, query: str) -> list[tuple[str, str]]:
        out: list[tuple[str, str]] = []
        q = query.lower()
        for server_name, cap in self.entries.items():
            for t in cap["tools"]:
                if q in t["name"].lower() or q in t["description"].lower():
                    out.append((server_name, t["name"]))
        return out


# ---------------------------------------------------------------------------
# demo servers  --  read-only and destructive
# ---------------------------------------------------------------------------

def build_readonly_server() -> MCPServer:
    s = MCPServer(name="internal-readonly-mcp", url="https://mcp.internal/readonly")
    s.register(ToolSchema("postgres.readonly", "postgres:query:readonly", False,
                          "Read-only Postgres query",
                          {"type": "object", "properties": {"sql": {"type": "string"}}}),
               lambda a: {"rows": [[1]], "sql_echo": a.get("sql", "")})
    s.register(ToolSchema("s3.list", "s3:list", False, "List S3 objects",
                          {"type": "object", "properties": {"bucket": {"type": "string"}}}),
               lambda a: {"objects": [{"key": "a/b.txt", "size": 128}]})
    s.register(ToolSchema("jira.search", "jira:read", False, "Search Jira issues",
                          {"type": "object", "properties": {"jql": {"type": "string"}}}),
               lambda a: {"issues": [{"id": "PROJ-42", "title": "fix widget"}]})
    return s


def build_destructive_server() -> MCPServer:
    s = MCPServer(name="internal-destructive-mcp", url="https://mcp.internal/destructive")
    s.register(ToolSchema("jira.create", "jira:write", True, "Create Jira issue",
                          {"type": "object", "properties": {"title": {"type": "string"}}}),
               lambda a: {"id": "PROJ-99", "created": True})
    return s


def main() -> None:
    ro = build_readonly_server()
    rw = build_destructive_server()
    registry = Registry()
    registry.register(ro)
    registry.register(rw)

    audit: list[AuditEntry] = []

    # token with read-only scopes
    readonly_token = Token(user="u42", scopes={"postgres:query:readonly",
                                               "s3:list",
                                               "jira:read"})
    # token with write scope but no fresh human approval
    write_token_no_approval = Token(user="u42", scopes={"jira:write"})
    # token with write scope AND approval fresh
    write_token_approved = Token(user="u42",
                                 scopes={"jira:write", "approved:by:human"},
                                 approved_at=time.time() - 60)

    print("=== registry search ===")
    print("  'jira' ->", registry.search("jira"))
    print("  'postgres' ->", registry.search("postgres"))

    print("\n=== dispatch: postgres.readonly (read scope) ===")
    r = dispatch(ro, readonly_token, "postgres.readonly",
                 {"sql": "SELECT email FROM users LIMIT 1"}, audit)
    print(" ", r)

    print("\n=== dispatch: jira.create without approval (expect deny) ===")
    r = dispatch(rw, write_token_no_approval, "jira.create", {"title": "new bug"}, audit)
    print(" ", r)

    print("\n=== dispatch: jira.create with fresh approval ===")
    r = dispatch(rw, write_token_approved, "jira.create", {"title": "new bug"}, audit)
    print(" ", r)

    print("\n=== audit log (redacted) ===")
    for e in audit:
        print(" ", json.dumps(asdict(e), default=str))


if __name__ == "__main__":
    main()
