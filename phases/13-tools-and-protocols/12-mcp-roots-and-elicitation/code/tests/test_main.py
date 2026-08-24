"""Tests for explicit workspace scope and stateless elicitation."""

from __future__ import annotations

import importlib.util
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson12_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class ScopeAndElicitationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.NotesServer()

    def test_uri_containment_accepts_child(self) -> None:
        self.assertTrue(
            main.uri_within_workspace(
                "file:///Users/alice/Documents/Notes",
                "file:///Users/alice/Documents/Notes/projects/a.md",
            )
        )

    def test_uri_containment_rejects_prefix_and_traversal(self) -> None:
        workspace = "file:///Users/alice/Documents/Notes"
        self.assertFalse(
            main.uri_within_workspace(
                workspace,
                "file:///Users/alice/Documents/Notes-evil/secret.md",
            )
        )
        self.assertFalse(
            main.uri_within_workspace(
                workspace,
                "file:///Users/alice/Documents/Notes/%2e%2e/private.md",
            )
        )

    def test_discovery_uses_modern_complete_result(self) -> None:
        response = self.server.dispatch(
            {
                "jsonrpc": "2.0",
                "id": 0,
                "method": "server/discover",
                "params": {"_meta": main.request_meta()},
            }
        )
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["supportedVersions"], ["2026-07-28"])
        self.assertNotIn("roots", response["result"]["capabilities"])

    def test_tools_list_is_deterministic_cacheable_and_described(self) -> None:
        response = self.server.dispatch(
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
        self.assertEqual(descriptor["name"], "notes_delete")
        self.assertEqual(
            descriptor["inputSchema"]["required"],
            ["workspaceUri", "title"],
        )

    def test_initial_delete_returns_embedded_elicitation(self) -> None:
        response = self.server.dispatch(main.tool_request(1))
        result = response["result"]
        self.assertEqual(result["resultType"], "input_required")
        self.assertEqual(
            result["inputRequests"]["delete_choice"]["method"],
            "elicitation/create",
        )
        self.assertEqual(
            result["inputRequests"]["delete_choice"]["params"]["mode"],
            "form",
        )

    def test_accepted_retry_deletes_selected_note(self) -> None:
        server, response, request_ids = main.run_mrtr(action="accept")
        self.assertEqual(request_ids, [1, 2])
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["structuredContent"]["noteId"], "note-14")
        self.assertNotIn("note-14", server.notes)

    def test_declined_retry_preserves_notes(self) -> None:
        server, response, _ = main.run_mrtr(action="decline")
        self.assertFalse(response["result"]["structuredContent"]["deleted"])
        self.assertIn("note-14", server.notes)

    def test_decline_is_terminal_for_the_confirmation_state(self) -> None:
        first = self.server.dispatch(main.tool_request(1))
        state = first["result"]["requestState"]
        declined = main.tool_request(2)
        declined["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {"action": "decline", "content": {}}
                },
                "requestState": state,
            }
        )
        self.assertFalse(
            self.server.dispatch(declined)["result"]["structuredContent"]["deleted"]
        )

        accepted = main.tool_request(3)
        accepted["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {
                        "action": "accept",
                        "content": {"note_id": "note-14", "confirm": True},
                    }
                },
                "requestState": state,
            }
        )
        replay = self.server.dispatch(accepted)
        self.assertEqual(replay["error"]["message"], "requestState was already consumed")
        self.assertIn("note-14", self.server.notes)

    def test_successful_confirmation_state_cannot_be_replayed(self) -> None:
        first = self.server.dispatch(main.tool_request(1))
        state = first["result"]["requestState"]
        retry = main.tool_request(2)
        retry["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {
                        "action": "accept",
                        "content": {"note_id": "note-14", "confirm": True},
                    }
                },
                "requestState": state,
            }
        )
        accepted = self.server.dispatch(retry)
        self.assertTrue(accepted["result"]["structuredContent"]["deleted"])

        replay = main.tool_request(3)
        replay["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {
                        "action": "accept",
                        "content": {"note_id": "note-7", "confirm": True},
                    }
                },
                "requestState": state,
            }
        )
        rejected = self.server.dispatch(replay)
        self.assertEqual(rejected["error"]["code"], -32602)
        self.assertIn("note-7", self.server.notes)

    def test_two_servers_consume_confirmation_atomically(self) -> None:
        class CoordinatedReplayStore(main.ReplayStore):
            def __init__(self) -> None:
                super().__init__(max_entries=10)
                self.ready = threading.Barrier(2)

            def claim_and_consume(self, nonce, **kwargs):
                self.ready.wait(timeout=2)
                return super().claim_and_consume(nonce, **kwargs)

        replay_store = CoordinatedReplayStore()
        first_server = main.NotesServer(replay_store=replay_store)
        second_server = main.NotesServer(
            notes=first_server.notes,
            replay_store=replay_store,
        )
        first = first_server.dispatch(main.tool_request(1))
        state = first["result"]["requestState"]

        def retry(server: main.NotesServer, request_id: int, note_id: str) -> dict:
            request = main.tool_request(request_id)
            request["params"].update(
                {
                    "inputResponses": {
                        "delete_choice": {
                            "action": "accept",
                            "content": {"note_id": note_id, "confirm": True},
                        }
                    },
                    "requestState": state,
                }
            )
            return server.dispatch(request)

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(
                pool.map(
                    lambda item: retry(*item),
                    (
                        (first_server, 2, "note-14"),
                        (second_server, 3, "note-7"),
                    ),
                )
            )

        self.assertEqual(sum("result" in response for response in responses), 1)
        self.assertEqual(sum("error" in response for response in responses), 1)
        self.assertEqual(
            sum(
                note_id in first_server.notes
                for note_id in ("note-14", "note-7")
            ),
            1,
        )

    def test_replay_store_is_bounded_and_prunes_expired_claims(self) -> None:
        now = [100.0]
        store = main.ReplayStore(max_entries=1, clock=lambda: now[0])
        completed: list[str] = []
        store.claim_and_consume(
            "first",
            expires_at=110.0,
            operation=lambda: completed.append("first"),
        )
        with self.assertRaisesRegex(main.McpError, "capacity exhausted"):
            store.claim_and_consume(
                "second",
                expires_at=120.0,
                operation=lambda: completed.append("second"),
            )
        self.assertEqual(completed, ["first"])

        now[0] = 111.0
        store.claim_and_consume(
            "second",
            expires_at=120.0,
            operation=lambda: completed.append("second"),
        )
        self.assertEqual(completed, ["first", "second"])

    def test_cancelled_or_invalid_confirmation_does_not_consume_state(self) -> None:
        first = self.server.dispatch(main.tool_request(1))
        state = first["result"]["requestState"]

        invalid = main.tool_request(2)
        invalid["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {
                        "action": "accept",
                        "content": {"note_id": "note-99", "confirm": True},
                    }
                },
                "requestState": state,
            }
        )
        self.assertEqual(self.server.dispatch(invalid)["error"]["code"], -32602)

        cancelled = main.tool_request(3)
        cancelled["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {"action": "cancel", "content": {}},
                },
                "requestState": state,
            }
        )
        self.assertFalse(
            self.server.dispatch(cancelled)["result"]["structuredContent"]["deleted"]
        )

        accepted = main.tool_request(4)
        accepted["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {
                        "action": "accept",
                        "content": {"note_id": "note-14", "confirm": True},
                    }
                },
                "requestState": state,
            }
        )
        response = self.server.dispatch(accepted)
        self.assertTrue(response["result"]["structuredContent"]["deleted"])

    def test_out_of_scope_match_is_not_exposed(self) -> None:
        response = self.server.dispatch(main.tool_request(1, title="outside root"))
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertTrue(response["result"]["isError"])
        self.assertEqual(
            response["result"]["content"][0]["text"],
            "no match in authorized workspace",
        )

    def test_missing_elicitation_capability_is_rejected(self) -> None:
        request = main.tool_request(1)
        request["params"]["_meta"] = main.request_meta(elicitation=False)
        response = self.server.dispatch(request)
        self.assertEqual(response["error"]["code"], -32021)
        self.assertEqual(
            response["error"]["data"],
            {"requiredCapabilities": {"elicitation": {"form": {}}}},
        )

    def test_empty_elicitation_capability_implicitly_supports_form(self) -> None:
        request = main.tool_request(1)
        request["params"]["_meta"][main.CAPABILITIES_META] = {"elicitation": {}}
        response = self.server.dispatch(request)
        self.assertEqual(response["result"]["resultType"], "input_required")
        self.assertEqual(
            response["result"]["inputRequests"]["delete_choice"]["params"]["mode"],
            "form",
        )

    def test_url_only_elicitation_does_not_support_form(self) -> None:
        request = main.tool_request(1)
        request["params"]["_meta"][main.CAPABILITIES_META] = {
            "elicitation": {"url": {}}
        }
        response = self.server.dispatch(request)
        self.assertEqual(response["error"]["code"], -32021)
        self.assertEqual(
            response["error"]["data"],
            {"requiredCapabilities": {"elicitation": {"form": {}}}},
        )

    def test_changed_arguments_cannot_reuse_state(self) -> None:
        first = self.server.dispatch(main.tool_request(1))
        retry = main.tool_request(2, title="shopping")
        retry["params"].update(
            {
                "inputResponses": {
                    "delete_choice": {
                        "action": "accept",
                        "content": {"note_id": "note-14", "confirm": True},
                    }
                },
                "requestState": first["result"]["requestState"],
            }
        )
        response = self.server.dispatch(retry)
        self.assertEqual(response["error"]["code"], -32602)

    def test_continuation_fields_require_presence_and_non_null_values(self) -> None:
        first = self.server.dispatch(main.tool_request(1))
        state = first["result"]["requestState"]
        cases = [
            ({"requestState": state}, "provided together"),
            ({"inputResponses": {}}, "provided together"),
            (
                {"requestState": None, "inputResponses": {}},
                "requestState must be a string",
            ),
            (
                {"requestState": state, "inputResponses": None},
                "inputResponses must be an object",
            ),
        ]
        for continuation, message in cases:
            with self.subTest(continuation=continuation):
                request = main.tool_request(2)
                request["params"].update(continuation)
                response = self.server.dispatch(request)
                self.assertEqual(response["error"]["code"], -32602)
                self.assertIn(message, response["error"]["message"])

    def test_unsupported_version_is_rejected(self) -> None:
        request = main.tool_request(1)
        request["params"]["_meta"][main.PROTOCOL_META] = "2025-11-25"
        response = self.server.dispatch(request)
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": "2025-11-25"},
        )

    def test_non_string_protocol_version_is_invalid_params(self) -> None:
        request = main.tool_request(1)
        request["params"]["_meta"][main.PROTOCOL_META] = None
        response = self.server.dispatch(request)
        self.assertEqual(response["error"]["code"], -32602)

    def test_notification_never_receives_a_json_rpc_response(self) -> None:
        request = main.tool_request(1, title="no matching note")
        del request["id"]
        self.assertIsNone(self.server.dispatch(request))


if __name__ == "__main__":
    unittest.main()
