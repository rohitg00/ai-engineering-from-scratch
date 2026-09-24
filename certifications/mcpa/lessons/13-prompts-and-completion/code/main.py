"""Companion code for:
certifications/mcpa/lessons/13-prompts-and-completion/docs/en.md
A prompts server with pagination, argument templates, and completion.
Sources: MCP 2026-07-28 Prompts and Completion pages.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601

MAX_COMPLETION_VALUES = 100


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


@dataclass
class Prompt:
    name: str
    title: str
    description: str
    arguments: list[dict[str, Any]]
    render: Callable[[dict[str, str]], list[dict[str, Any]]]

    def definition(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "arguments": self.arguments,
        }

    def required(self) -> list[str]:
        return [argument["name"] for argument in self.arguments if argument.get("required")]


def render_code_review(args: dict[str, str]) -> list[dict[str, Any]]:
    language = args["language"]
    framework = args.get("framework", "no particular framework")
    return [
        {
            "role": "user",
            "content": {
                "type": "text",
                "text": f"Review this {language} snippet for style and correctness. Follow {framework} community conventions where they apply.",
            },
        },
        {
            "role": "user",
            "content": {
                "type": "resource_link",
                "uri": f"file:///styleguides/{language}.md",
                "name": f"{language}-style-guide.md",
                "description": "Style guide to check the snippet against",
                "mimeType": "text/markdown",
            },
        },
    ]


def render_bug_triage(args: dict[str, str]) -> list[dict[str, Any]]:
    return [
        {
            "role": "user",
            "content": {"type": "text", "text": f"Triage this bug report and propose a severity:\n{args['logs']}"},
        }
    ]


PROMPTS: dict[str, Prompt] = {
    "code_review": Prompt(
        name="code_review",
        title="Request Code Review",
        description="Ask the model to review a snippet against a language and framework's conventions.",
        arguments=[
            {"name": "language", "description": "Programming language of the snippet", "required": True},
            {"name": "framework", "description": "Web framework the snippet uses", "required": False},
        ],
        render=render_code_review,
    ),
    "bug_triage": Prompt(
        name="bug_triage",
        title="Triage a Bug Report",
        description="Summarize a bug report from its log excerpt and propose a severity.",
        arguments=[{"name": "logs", "description": "Relevant log excerpt", "required": True}],
        render=render_bug_triage,
    ),
}
PROMPT_ORDER = ["code_review", "bug_triage"]
CURSOR_START: dict[str | None, int] = {None: 0, "after-code_review": 1}

LANGUAGES = ["go", "java", "javascript", "julia", "kotlin", "python", "rust", "typescript"]
FRAMEWORKS_BY_LANGUAGE = {
    "python": ["django", "falcon", "fastapi", "flask"],
    "javascript": ["express", "fastify", "koa", "nestjs"],
    "java": ["micronaut", "quarkus", "spring", "vertx"],
}
ALL_FRAMEWORKS = sorted({name for names in FRAMEWORKS_BY_LANGUAGE.values() for name in names})

SRC_MODULES = ["admin", "auth", "billing", "catalog", "notifications", "reports", "scheduler", "search"]
SRC_NAMES = [
    "adapters", "cache", "clients", "constants", "exceptions", "forms", "handlers", "migrations",
    "models", "permissions", "serializers", "signals", "tasks", "tests", "urls", "utils",
    "validators", "views",
]
SRC_FILES = sorted(f"{module}/{name}.py" for module in SRC_MODULES for name in SRC_NAMES)


def handle_prompts_list(request_id: Any, params: dict) -> dict:
    cursor = params.get("cursor")
    if cursor not in CURSOR_START:
        return make_error(request_id, INVALID_PARAMS, f"Invalid cursor: {cursor!r}", {"cursor": cursor})
    start = CURSOR_START[cursor]
    page = PROMPT_ORDER[start:start + 1]
    fields: dict[str, Any] = {
        "prompts": [PROMPTS[name].definition() for name in page],
        "ttlMs": 600000,
        "cacheScope": "public",
    }
    end = start + 1
    if end < len(PROMPT_ORDER):
        fields["nextCursor"] = f"after-{page[0]}"
    return make_result(request_id, **fields)


def handle_prompts_get(request_id: Any, params: dict) -> dict:
    name = params.get("name")
    prompt = PROMPTS.get(name)
    if prompt is None:
        return make_error(request_id, INVALID_PARAMS, f"Unknown prompt: {name}", {"name": name})
    arguments = params.get("arguments") or {}
    missing = [key for key in prompt.required() if key not in arguments]
    if missing:
        return make_error(
            request_id,
            INVALID_PARAMS,
            f"Missing required argument(s): {', '.join(missing)}",
            {"missingArguments": missing},
        )
    messages = prompt.render(arguments)
    return make_result(request_id, description=prompt.description, messages=messages)


def _cap(matches: list[str]) -> dict[str, Any]:
    total = len(matches)
    return {"values": matches[:MAX_COMPLETION_VALUES], "total": total, "hasMore": total > MAX_COMPLETION_VALUES}


def _complete_prompt_argument(argument_name: str, value: str, context_arguments: dict[str, str]) -> list[str]:
    prefix = value.lower()
    if argument_name == "language":
        pool = LANGUAGES
    elif argument_name == "framework":
        language = context_arguments.get("language")
        pool = FRAMEWORKS_BY_LANGUAGE.get(language, ALL_FRAMEWORKS)
    else:
        pool = []
    return sorted(candidate for candidate in pool if candidate.lower().startswith(prefix))


def _complete_resource_path(value: str) -> list[str]:
    prefix = value.lower()
    return sorted(path for path in SRC_FILES if path.lower().startswith(prefix))


def handle_completion_complete(request_id: Any, params: dict) -> dict:
    ref = params.get("ref") or {}
    argument = params.get("argument") or {}
    context = params.get("context") or {}
    context_arguments = context.get("arguments") or {}
    value = argument.get("value", "")
    ref_type = ref.get("type")
    if ref_type == "ref/prompt":
        name = ref.get("name")
        if name not in PROMPTS:
            return make_error(request_id, INVALID_PARAMS, f"Unknown prompt: {name}", {"name": name})
        matches = _complete_prompt_argument(argument.get("name"), value, context_arguments)
    elif ref_type == "ref/resource":
        matches = _complete_resource_path(value)
    else:
        return make_error(request_id, INVALID_PARAMS, f"Unknown reference type: {ref_type}", {"type": ref_type})
    return make_result(request_id, completion=_cap(matches))


class PromptServer:
    def __init__(self) -> None:
        self.name = "code-tools"

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        method = message.get("method")
        if method == "prompts/list":
            response = handle_prompts_list(request_id, params)
        elif method == "prompts/get":
            response = handle_prompts_get(request_id, params)
        elif method == "completion/complete":
            response = handle_completion_complete(request_id, params)
        else:
            response = make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")
        if "result" in response:
            response["result"].setdefault("_meta", self._server_meta())
        return response


class Client:
    def __init__(self, server: PromptServer) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def list_prompts(self, cursor: str | None = None) -> dict:
        params = {"cursor": cursor} if cursor is not None else {}
        return self.send("prompts/list", params)

    def get_prompt(self, name: str, arguments: dict[str, str] | None = None) -> dict:
        return self.send("prompts/get", {"name": name, "arguments": arguments or {}})

    def complete(self, ref: dict, argument: dict, context: dict | None = None) -> dict:
        params: dict[str, Any] = {"ref": ref, "argument": argument}
        if context is not None:
            params["context"] = context
        return self.send("completion/complete", params)


def run_scenario() -> Client:
    client = Client(PromptServer())
    client.list_prompts()
    client.list_prompts(cursor="after-code_review")
    client.list_prompts(cursor="bogus-cursor")
    client.get_prompt("code_review", {"language": "python", "framework": "flask"})
    client.get_prompt("code_review", {})
    client.get_prompt("release_notes", {})
    client.complete({"type": "ref/prompt", "name": "code_review"}, {"name": "language", "value": "ja"})
    client.complete({"type": "ref/prompt", "name": "code_review"}, {"name": "framework", "value": "fa"})
    client.complete(
        {"type": "ref/prompt", "name": "code_review"},
        {"name": "framework", "value": "fa"},
        context={"arguments": {"language": "python"}},
    )
    client.complete({"type": "ref/resource", "uri": "file:///src/{path}"}, {"name": "path", "value": ""})
    client.complete({"type": "ref/resource", "uri": "file:///src/{path}"}, {"name": "path", "value": "auth/"})
    return client


def transcript() -> list[dict]:
    return run_scenario().log


def demo() -> None:
    client = run_scenario()
    print(f"src file catalog: {len(SRC_FILES)} entries")
    for message in client.log:
        print(json.dumps(message, sort_keys=True)[:200])


if __name__ == "__main__":
    demo()
