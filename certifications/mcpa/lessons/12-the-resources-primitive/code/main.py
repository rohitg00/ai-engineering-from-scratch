"""Companion code for:
certifications/mcpa/lessons/12-the-resources-primitive/docs/en.md
A resource server over an in-memory project tree with a URI template, binary contents, traversal
protection, and cache hints.
Sources: MCP 2026-07-28 Resources page; RFC 6570; RFC 3986.
"""

from __future__ import annotations

import base64
import json
import posixpath
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601
UNSUPPORTED_PROTOCOL_VERSION = -32022

ROOT_PREFIX = "file:///project/"
TEMPLATE_RE = re.compile(r"\{(\+?[A-Za-z0-9_]+)\}")
RESERVED_SAFE = "/:?#[]@!$&'()*+,;="

LOGO_BYTES = b"\x89PNG\r\n\x1a\n" + bytes(range(16))


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


def expand_template(template: str, values: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        token = match.group(1)
        reserved = token.startswith("+")
        name = token[1:] if reserved else token
        value = values.get(name, "")
        return quote(value, safe=RESERVED_SAFE if reserved else "")

    return TEMPLATE_RE.sub(replace, template)


def resolve_under_root(uri: str) -> str | None:
    if not uri.startswith(ROOT_PREFIX):
        return None
    tail = uri[len(ROOT_PREFIX):]
    normalized = posixpath.normpath("/" + tail).lstrip("/")
    if normalized in ("", "."):
        return None
    return ROOT_PREFIX + normalized


@dataclass
class Resource:
    uri: str
    name: str
    description: str
    mime_type: str
    text: str | None = None
    blob: bytes | None = None
    cache_scope: str = "public"
    ttl_ms: int = 300000
    annotations: dict | None = None

    def definition(self) -> dict:
        entry: dict[str, Any] = {
            "uri": self.uri,
            "name": self.name,
            "description": self.description,
            "mimeType": self.mime_type,
        }
        if self.annotations:
            entry["annotations"] = self.annotations
        return entry

    def content(self) -> dict:
        body: dict[str, Any] = {"uri": self.uri, "mimeType": self.mime_type}
        if self.blob is not None:
            body["blob"] = base64.b64encode(self.blob).decode("ascii")
        else:
            body["text"] = self.text
        return body


@dataclass
class WorkspaceServer:
    name: str = "workspace"
    resources: dict[str, Resource] = field(default_factory=dict)
    directories: dict[str, list[str]] = field(default_factory=dict)
    templates: list[dict] = field(default_factory=list)

    def add(self, resource: Resource) -> None:
        self.resources[resource.uri] = resource

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if PV_KEY not in meta or CAPS_KEY not in meta:
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return make_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        method = message.get("method")
        if method == "server/discover":
            return make_result(
                request_id,
                supportedVersions=[PROTOCOL_VERSION],
                capabilities={"resources": {"listChanged": True, "subscribe": True}},
                ttlMs=3600000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "resources/list":
            return self._list(request_id)
        if method == "resources/templates/list":
            return self._list_templates(request_id)
        if method == "resources/read":
            return self._read(request_id, params)
        return make_error(request_id, METHOD_NOT_FOUND, f"Unknown method: {method}")

    def _list(self, request_id: Any) -> dict:
        listing = [self.resources[uri].definition() for uri in sorted(self.resources)]
        return make_result(request_id, resources=listing, ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def _list_templates(self, request_id: Any) -> dict:
        return make_result(
            request_id, resourceTemplates=list(self.templates), ttlMs=300000, cacheScope="public",
            _meta=self._server_meta(),
        )

    def _resolve(self, uri: str | None) -> str | None:
        if not uri:
            return None
        if uri in self.resources or uri in self.directories:
            return uri
        candidate = resolve_under_root(uri)
        if candidate and (candidate in self.resources or candidate in self.directories):
            return candidate
        return None

    def _read(self, request_id: Any, params: dict) -> dict:
        uri = params.get("uri")
        resolved = self._resolve(uri)
        if resolved is None:
            return make_error(request_id, INVALID_PARAMS, "Resource not found", {"uri": uri})
        if resolved in self.directories:
            contents = [self.resources[member].content() for member in self.directories[resolved]]
            return make_result(request_id, contents=contents, ttlMs=120000, cacheScope="public", _meta=self._server_meta())
        resource = self.resources[resolved]
        return make_result(
            request_id, contents=[resource.content()], ttlMs=resource.ttl_ms, cacheScope=resource.cache_scope,
            _meta=self._server_meta(),
        )


class Client:
    def __init__(self, server: WorkspaceServer) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, version=version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        return self.send("server/discover")["result"]

    def list_resources(self) -> list[dict]:
        return self.send("resources/list")["result"]["resources"]

    def list_templates(self) -> list[dict]:
        return self.send("resources/templates/list")["result"]["resourceTemplates"]

    def read(self, uri: str) -> dict:
        return self.send("resources/read", {"uri": uri})

    def read_template(self, template: str, **values: str) -> dict:
        return self.read(expand_template(template, values))


def build_workspace_server() -> WorkspaceServer:
    server = WorkspaceServer()
    server.add(Resource(
        uri="file:///project/README.md",
        name="README.md",
        description="Project overview and layout",
        mime_type="text/markdown",
        text="# Workspace\n\nA stateless resource server for the resources primitive lesson. "
             "See src/ for source files and assets/ for binary files.\n",
        annotations={"audience": ["user"], "priority": 0.8, "lastModified": "2026-07-20T09:00:00Z"},
    ))
    server.add(Resource(
        uri="file:///project/src",
        name="src",
        description="Source directory; reading it returns every file inside",
        mime_type="inode/directory",
        text="(directory)",
    ))
    server.add(Resource(
        uri="file:///project/src/app.py",
        name="app.py",
        description="Application entry point",
        mime_type="text/x-python",
        text="def main() -> None:\n    print(\"hello from the workspace\")\n",
    ))
    server.add(Resource(
        uri="file:///project/src/utils.py",
        name="utils.py",
        description="Shared helper functions",
        mime_type="text/x-python",
        text="def slugify(title: str) -> str:\n    return title.strip().lower().replace(\" \", \"-\")\n",
    ))
    server.add(Resource(
        uri="file:///project/assets/logo.png",
        name="logo.png",
        description="Project logo",
        mime_type="image/png",
        blob=LOGO_BYTES,
    ))
    server.add(Resource(
        uri="git://main/CHANGELOG.md",
        name="CHANGELOG.md",
        description="Version-controlled change history",
        mime_type="text/markdown",
        text="## 2026-07-28\n\n- Adopt the stateless MCP core.\n- Add resource templates for project files.\n",
    ))
    server.add(Resource(
        uri="user://alice/notes/welcome",
        name="welcome",
        description="A private draft note for one authenticated user",
        mime_type="text/markdown",
        text="Draft: rename the workspace server before the demo on Thursday.\n",
        cache_scope="private",
        ttl_ms=60000,
    ))
    server.add(Resource(
        uri="https://docs.example.com/api-reference",
        name="API reference",
        description="Public web documentation a capable client can fetch directly",
        mime_type="text/html",
        text="Fetched directly by clients that support https; not proxied through resources/read.\n",
        ttl_ms=3600000,
    ))
    server.directories["file:///project/src"] = [
        "file:///project/src/app.py",
        "file:///project/src/utils.py",
    ]
    server.templates.append({
        "uriTemplate": "file:///project/{+path}",
        "name": "Project files",
        "description": "Any file under the project root, expanded from a path segment",
        "mimeType": "application/octet-stream",
    })
    return server


def run_scenario() -> Client:
    client = Client(build_workspace_server())
    client.discover()
    client.list_resources()
    client.list_templates()
    client.read("file:///project/README.md")
    client.read("file:///project/src")
    client.read_template("file:///project/{+path}", path="src/utils.py")
    client.read("file:///project/assets/logo.png")
    client.read("git://main/CHANGELOG.md")
    client.read("user://alice/notes/welcome")
    client.read("file:///project/missing.md")
    client.read("file:///project/../../../../etc/passwd")
    return client


def transcript() -> list[dict]:
    return run_scenario().log


def demo() -> None:
    client = run_scenario()
    print("workspace resource server: %d wire messages" % len(client.log))
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
