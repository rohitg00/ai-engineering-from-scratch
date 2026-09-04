"""Tests for the stateless MCP MRTR sampling migration lesson."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson11_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


def tool_request(request_id: int = 1, *, sampling: bool = True) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": "summarize_repo",
            "arguments": {"audience": "developer"},
            "_meta": main.request_meta(sampling=sampling),
        },
    }


class SamplingMrtrTests(unittest.TestCase):
    def test_discovery_is_complete_and_cacheable(self) -> None:
        response = main.dispatch(
            {
                "jsonrpc": "2.0",
                "id": 0,
                "method": "server/discover",
                "params": {"_meta": main.request_meta()},
            }
        )
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["supportedVersions"], ["2026-07-28"])
        self.assertEqual(response["result"]["ttlMs"], 300_000)
        self.assertIn(main.SERVER_INFO_META, response["result"]["_meta"])

    def test_tools_list_is_deterministic_cacheable_and_described(self) -> None:
        response = main.dispatch(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/list",
                "params": {"_meta": main.request_meta()},
            }
        )
        result = response["result"]
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["ttlMs"], 60_000)
        self.assertEqual(result["cacheScope"], "public")
        self.assertIn(main.SERVER_INFO_META, result["_meta"])
        self.assertEqual(
            [tool["name"] for tool in result["tools"]],
            sorted(tool["name"] for tool in result["tools"]),
        )
        descriptor = result["tools"][0]
        self.assertEqual(descriptor["name"], "summarize_repo")
        self.assertEqual(descriptor["inputSchema"]["type"], "object")

    def test_tools_list_returns_independent_descriptors(self) -> None:
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {"_meta": main.request_meta()},
        }
        first = main.dispatch(request)["result"]["tools"]
        first[0]["inputSchema"]["properties"]["audience"]["type"] = "integer"
        second = main.dispatch({**request, "id": 3})["result"]["tools"]
        self.assertEqual(
            second[0]["inputSchema"]["properties"]["audience"]["type"],
            "string",
        )

    def test_initial_call_returns_embedded_sampling_request(self) -> None:
        response = main.dispatch(tool_request())
        result = response["result"]
        self.assertEqual(result["resultType"], "input_required")
        self.assertEqual(
            result["inputRequests"]["pick_files"]["method"],
            "sampling/createMessage",
        )
        self.assertIsInstance(result["requestState"], str)

    def test_client_driver_uses_fresh_ids_and_finishes(self) -> None:
        response, request_ids = main.run_mrtr()
        self.assertEqual(request_ids, [1, 2, 3])
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertFalse(response["result"]["isError"])
        self.assertEqual(len(response["result"]["structuredContent"]["picked"]), 3)

    def test_unsupported_protocol_version_is_rejected(self) -> None:
        request = tool_request()
        request["params"]["_meta"][main.PROTOCOL_META] = "2025-11-25"
        response = main.dispatch(request)
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": "2025-11-25"},
        )

    def test_missing_request_metadata_is_rejected(self) -> None:
        request = tool_request()
        del request["params"]["_meta"]
        response = main.dispatch(request)
        self.assertEqual(response["error"]["code"], -32602)

    def test_non_string_protocol_version_is_invalid_params(self) -> None:
        request = tool_request()
        request["params"]["_meta"][main.PROTOCOL_META] = None
        response = main.dispatch(request)
        self.assertEqual(response["error"]["code"], -32602)

    def test_sampling_capability_is_required(self) -> None:
        response = main.dispatch(tool_request(sampling=False))
        self.assertEqual(response["error"]["code"], -32021)
        self.assertEqual(
            response["error"]["data"],
            {"requiredCapabilities": {"sampling": {}}},
        )

    def test_notification_never_receives_a_json_rpc_response(self) -> None:
        request = tool_request()
        del request["id"]
        self.assertIsNone(main.dispatch(request))

    def test_request_state_tampering_is_rejected(self) -> None:
        response = main.dispatch(tool_request())
        token = response["result"]["requestState"]
        tampered = ("A" if token[0] != "A" else "B") + token[1:]
        retry = tool_request(2)
        retry["params"].update(
            {
                "requestState": tampered,
                "inputResponses": {
                    "pick_files": main.fake_host_model(
                        response["result"]["inputRequests"]["pick_files"]
                    )
                },
            }
        )
        rejected = main.dispatch(retry)
        self.assertEqual(rejected["error"]["code"], -32602)

    def test_request_state_is_bound_to_original_arguments(self) -> None:
        response = main.dispatch(tool_request())
        retry = tool_request(2)
        retry["params"]["arguments"] = {"audience": "executive"}
        retry["params"].update(
            {
                "requestState": response["result"]["requestState"],
                "inputResponses": {
                    "pick_files": {
                        "role": "assistant",
                        "content": {
                            "type": "text",
                            "text": json.dumps(["README.md"]),
                        },
                        "model": "host-model",
                        "stopReason": "endTurn",
                    }
                },
            }
        )
        rejected = main.dispatch(retry)
        self.assertEqual(rejected["error"]["code"], -32602)

    def test_expired_request_state_is_rejected(self) -> None:
        arguments = {"audience": "developer"}
        token = main.seal_request_state(
            {
                "phase": "pick",
                "principal": "user-42",
                "method": "tools/call",
                "argumentsDigest": main._arguments_digest(arguments),
                "expiresAt": 10,
            }
        )
        with self.assertRaises(main.McpError) as context:
            main.verify_request_state(
                token,
                principal="user-42",
                arguments=arguments,
                now=11,
            )
        self.assertEqual(context.exception.code, -32602)


if __name__ == "__main__":
    unittest.main()
