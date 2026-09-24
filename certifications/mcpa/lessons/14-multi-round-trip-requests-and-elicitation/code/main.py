"""Companion code for:
certifications/mcpa/lessons/14-multi-round-trip-requests-and-elicitation/docs/en.md
A deploy tool gated by MRTR elicitation and HMAC-protected requestState.
Sources: SEP-2322 (multi round-trip requests); MCP 2026-07-28 Elicitation page.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021


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


DEPLOY_TOOL_NAME = "deploy_release"
ELICIT_KEY = "confirm"
STATE_TTL_TICKS = 10
REQUIRES_CAPABILITY = {"elicitation": {}}

DEPLOY_TOOL = {
    "name": DEPLOY_TOOL_NAME,
    "description": "Deploy a service to an environment. Destructive: replaces the running release. Always asks for explicit confirmation before it executes.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "service": {"type": "string"},
            "environment": {"type": "string"},
        },
        "required": ["service", "environment"],
    },
    "annotations": {"destructiveHint": True, "idempotentHint": False, "openWorldHint": False, "readOnlyHint": False},
}


@dataclass
class Clock:
    now: int = 0

    def advance(self, ticks: int = 1) -> None:
        self.now += ticks


def digest_request(name: str, arguments: dict[str, Any]) -> str:
    canonical = json.dumps({"method": "tools/call", "name": name, "arguments": arguments}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def mint_request_state(secret: bytes, principal: str, name: str, arguments: dict[str, Any], issued_at: int, nonce: str,
                       ttl_ticks: int = STATE_TTL_TICKS) -> str:
    payload = {
        "principal": principal,
        "expiresAt": issued_at + ttl_ticks,
        "requestDigest": digest_request(name, arguments),
        "nonce": nonce,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode("utf-8")).decode("ascii")
    signature = hmac.new(secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


@dataclass
class StateVerdict:
    ok: bool
    reason: str
    payload: dict[str, Any] | None = None


def verify_request_state(secret: bytes, state: Any, principal: str, name: str, arguments: dict[str, Any], now: int,
                         consumed: set[str]) -> StateVerdict:
    if not isinstance(state, str) or not state.isascii() or "." not in state:
        return StateVerdict(False, "requestState is missing or malformed")
    encoded, _, signature = state.rpartition(".")
    expected_signature = hmac.new(secret, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return StateVerdict(False, "requestState signature does not verify; it was tampered with after the server issued it")
    try:
        payload = json.loads(base64.urlsafe_b64decode(encoded.encode("ascii")).decode("utf-8"))
    except Exception:
        return StateVerdict(False, "requestState payload could not be decoded")
    if payload.get("principal") != principal:
        return StateVerdict(False, "requestState was minted for a different principal")
    if now > payload.get("expiresAt", -1):
        return StateVerdict(False, "requestState expired before the retry arrived")
    if payload.get("requestDigest") != digest_request(name, arguments):
        return StateVerdict(False, "requestState does not match the request it was minted for")
    if payload.get("nonce") in consumed:
        return StateVerdict(False, "requestState was already redeemed")
    return StateVerdict(True, "ok", payload)


@dataclass
class DeployServer:
    name: str = "release-gateway"
    version: str = "1.0.0"
    secret: bytes = b"lesson-demo-hmac-key-do-not-reuse-in-production"
    clock: Clock = field(default_factory=Clock)
    consumed_nonces: set[str] = field(default_factory=set)
    deployed: list[dict[str, str]] = field(default_factory=list)
    _nonce_seq: int = 0

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": self.version}}

    def _mint_nonce(self) -> str:
        self._nonce_seq += 1
        return f"nonce-{self._nonce_seq}"

    def handle(self, message: dict, principal: str) -> dict:
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else None
        if not isinstance(meta, dict) or not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta protocol fields")
        method = message.get("method")
        if method != "tools/call":
            return make_error(request_id, METHOD_NOT_FOUND, f"Unknown method: {method}")
        return self._call(request_id, params, meta[CAPS_KEY], principal)

    def _call(self, request_id: Any, params: dict, client_capabilities: dict, principal: str) -> dict:
        name = params.get("name")
        if name != DEPLOY_TOOL_NAME:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") or {}
        missing = [key for key in DEPLOY_TOOL["inputSchema"]["required"] if key not in arguments]
        if missing:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}. Provide them and call again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        is_retry = "inputResponses" in params or "requestState" in params
        if not is_retry:
            return self._ask_for_confirmation(request_id, name, arguments, client_capabilities, principal)
        return self._resume(request_id, name, arguments, params, principal)

    def _ask_for_confirmation(self, request_id: Any, name: str, arguments: dict, client_capabilities: dict, principal: str) -> dict:
        missing_caps = {key: value for key, value in REQUIRES_CAPABILITY.items() if key not in client_capabilities}
        if missing_caps:
            return make_error(
                request_id,
                MISSING_REQUIRED_CLIENT_CAPABILITY,
                f"{name} asks for confirmation through elicitation, which this request did not declare",
                {"requiredCapabilities": missing_caps},
            )
        nonce = self._mint_nonce()
        state = mint_request_state(self.secret, principal, name, arguments, self.clock.now, nonce)
        return make_result(
            request_id,
            result_type="input_required",
            inputRequests={
                ELICIT_KEY: {
                    "method": "elicitation/create",
                    "params": {
                        "mode": "form",
                        "message": f"Deploy {arguments.get('service')} to {arguments.get('environment')}? This replaces the running release.",
                        "requestedSchema": {
                            "type": "object",
                            "properties": {
                                "confirmed": {
                                    "type": "boolean",
                                    "title": "Confirm deploy",
                                    "description": "Approve replacing the running release",
                                    "default": False,
                                }
                            },
                            "required": ["confirmed"],
                        },
                    },
                }
            },
            requestState=state,
            _meta=self._server_meta(),
        )

    def _resume(self, request_id: Any, name: str, arguments: dict, params: dict, principal: str) -> dict:
        state = params.get("requestState")
        verdict = verify_request_state(self.secret, state, principal, name, arguments, self.clock.now, self.consumed_nonces)
        if not verdict.ok:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Confirmation rejected: {verdict.reason}. Call {name} again to request a fresh confirmation."}],
                isError=True,
                _meta=self._server_meta(),
            )
        self.consumed_nonces.add(verdict.payload["nonce"])
        responses = params.get("inputResponses") if isinstance(params.get("inputResponses"), dict) else {}
        confirm = responses.get(ELICIT_KEY)
        approved = (
            isinstance(confirm, dict)
            and confirm.get("action") == "accept"
            and isinstance(confirm.get("content"), dict)
            and confirm["content"].get("confirmed") is True
        )
        if approved:
            self.deployed.append({"service": arguments["service"], "environment": arguments["environment"]})
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Deployed {arguments['service']} to {arguments['environment']}"}],
                structuredContent={"service": arguments["service"], "environment": arguments["environment"], "deployed": True},
                isError=False,
                _meta=self._server_meta(),
            )
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Deployment of {arguments['service']} to {arguments['environment']} was not performed; confirmation was not given."}],
            structuredContent={"service": arguments["service"], "environment": arguments["environment"], "deployed": False},
            isError=False,
            _meta=self._server_meta(),
        )


class Client:
    def __init__(self, principal: str, server: DeployServer, capabilities: dict[str, Any] | None = None) -> None:
        self.principal = principal
        self.server = server
        self.capabilities = {"elicitation": {}} if capabilities is None else capabilities
        self.next_id = 0
        self.log: list[Any] = []

    def call(self, arguments: dict[str, Any], input_responses: dict[str, Any] | None = None, request_state: Any = None,
             violation: str | None = None) -> dict:
        self.next_id += 1
        params: dict[str, Any] = {"name": DEPLOY_TOOL_NAME, "arguments": arguments}
        if input_responses is not None:
            params["inputResponses"] = input_responses
        if request_state is not None:
            params["requestState"] = request_state
        request = make_request(self.next_id, "tools/call", params, capabilities=self.capabilities)
        response = self.server.handle(request, principal=self.principal)
        self.log.append({"violation": violation, "message": request} if violation else request)
        self.log.append(response)
        return response


def run_scenario() -> dict[str, Any]:
    server = DeployServer()
    alice = Client("user-alice", server)
    mallory = Client("user-mallory", server)
    guest = Client("user-guest", server, capabilities={})

    refused = guest.call({"service": "checkout", "environment": "staging"})

    ask_accept = alice.call({"service": "checkout", "environment": "production"})
    state_accept = ask_accept["result"]["requestState"]
    accepted = alice.call(
        {"service": "checkout", "environment": "production"},
        input_responses={ELICIT_KEY: {"action": "accept", "content": {"confirmed": True}}},
        request_state=state_accept,
    )

    ask_decline = alice.call({"service": "billing", "environment": "production"})
    state_decline = ask_decline["result"]["requestState"]
    declined = alice.call(
        {"service": "billing", "environment": "production"},
        input_responses={ELICIT_KEY: {"action": "decline"}},
        request_state=state_decline,
    )

    ask_tamper = alice.call({"service": "search", "environment": "production"})
    state_tamper = ask_tamper["result"]["requestState"]
    tampered_state = state_tamper[:-1] + ("0" if state_tamper[-1] != "0" else "1")
    tampered = alice.call(
        {"service": "search", "environment": "production"},
        input_responses={ELICIT_KEY: {"action": "accept", "content": {"confirmed": True}}},
        request_state=tampered_state,
        violation="the retry carries a requestState whose signature was altered after the server issued it",
    )

    ask_expire = alice.call({"service": "search", "environment": "staging"})
    state_expire = ask_expire["result"]["requestState"]
    server.clock.advance(STATE_TTL_TICKS + 1)
    expired = alice.call(
        {"service": "search", "environment": "staging"},
        input_responses={ELICIT_KEY: {"action": "accept", "content": {"confirmed": True}}},
        request_state=state_expire,
        violation="the retry arrives after the requestState's short expiry has passed",
    )

    ask_steal = alice.call({"service": "payments", "environment": "production"})
    state_steal = ask_steal["result"]["requestState"]
    stolen = mallory.call(
        {"service": "payments", "environment": "production"},
        input_responses={ELICIT_KEY: {"action": "accept", "content": {"confirmed": True}}},
        request_state=state_steal,
        violation="mallory replays a requestState the server minted for alice's principal",
    )

    ask_retarget = alice.call({"service": "search", "environment": "canary"})
    state_retarget = ask_retarget["result"]["requestState"]
    retargeted = alice.call(
        {"service": "search", "environment": "production"},
        input_responses={ELICIT_KEY: {"action": "accept", "content": {"confirmed": True}}},
        request_state=state_retarget,
        violation="the retry names a different environment than the request the requestState was bound to",
    )

    return {
        "server": server,
        "clients": {"alice": alice, "mallory": mallory, "guest": guest},
        "results": {
            "refused": refused,
            "ask_accept": ask_accept,
            "accepted": accepted,
            "ask_decline": ask_decline,
            "declined": declined,
            "ask_tamper": ask_tamper,
            "tampered": tampered,
            "ask_expire": ask_expire,
            "expired": expired,
            "ask_steal": ask_steal,
            "stolen": stolen,
            "ask_retarget": ask_retarget,
            "retargeted": retargeted,
        },
    }


def transcript() -> list[Any]:
    scenario = run_scenario()
    clients = scenario["clients"]
    return clients["guest"].log + clients["alice"].log + clients["mallory"].log


def demo() -> None:
    scenario = run_scenario()
    results = scenario["results"]
    print("guest declared no elicitation capability:")
    print(" ", json.dumps(results["refused"]["error"], sort_keys=True))
    print()
    print("alice confirms a deploy (form elicitation, accept):")
    print("  ask     ->", results["ask_accept"]["result"]["resultType"])
    print("  retry   ->", json.dumps(results["accepted"]["result"], sort_keys=True)[:220])
    print()
    print("alice declines a deploy (non destructive result):")
    print("  retry   ->", json.dumps(results["declined"]["result"], sort_keys=True)[:220])
    print()
    print("tampered requestState signature:")
    print("  retry   ->", json.dumps(results["tampered"]["result"], sort_keys=True)[:220])
    print()
    print("expired requestState:")
    print("  retry   ->", json.dumps(results["expired"]["result"], sort_keys=True)[:220])
    print()
    print("mallory replays alice's requestState:")
    print("  retry   ->", json.dumps(results["stolen"]["result"], sort_keys=True)[:220])
    print()
    print("retry retargeted to a different environment than the state was bound to:")
    print("  retry   ->", json.dumps(results["retargeted"]["result"], sort_keys=True)[:220])
    print()
    print("deployments actually performed:", scenario["server"].deployed)


if __name__ == "__main__":
    demo()
