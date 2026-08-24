"""Tests for the stateless MCP Tasks extension lesson."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "main.py"
SPEC = importlib.util.spec_from_file_location("lesson13_main", MODULE_PATH)
assert SPEC and SPEC.loader
main = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = main
SPEC.loader.exec_module(main)


class TasksExtensionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="lesson13-test-")
        self.directory = Path(self.temporary.name)
        self.service = main.TaskService(self.directory)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def create_task(self, *, tasks: bool = True) -> dict:
        return self.service.dispatch(
            main.make_request(
                1,
                "tools/call",
                {"name": "generate_report", "arguments": {"size": "large"}},
                tasks=tasks,
            )
        )

    def test_discovery_advertises_tasks_extension(self) -> None:
        response = self.service.dispatch(main.make_request(0, "server/discover", {}))
        capabilities = response["result"]["capabilities"]
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertEqual(response["result"]["supportedVersions"], ["2026-07-28"])
        self.assertIn(main.TASKS_EXTENSION, capabilities["extensions"])

    def test_tools_list_is_deterministic_cacheable_and_described(self) -> None:
        response = self.service.dispatch(main.make_request(1, "tools/list", {}))
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
        self.assertEqual(descriptor["name"], "generate_report")
        self.assertEqual(
            descriptor["inputSchema"]["properties"]["size"]["enum"],
            ["small", "medium", "large"],
        )

    def test_server_directed_creation_returns_task_result(self) -> None:
        request = main.make_request(
            1,
            "tools/call",
            {"name": "generate_report", "arguments": {"size": "large"}},
        )
        self.assertNotIn("task", request["params"].get("_meta", {}))
        response = self.service.dispatch(request)
        self.assertEqual(response["result"]["resultType"], "task")
        self.assertEqual(response["result"]["status"], "working")

    def test_missing_extension_capability_is_rejected(self) -> None:
        response = self.create_task(tasks=False)
        self.assertEqual(response["error"]["code"], -32021)
        self.assertEqual(
            response["error"]["data"],
            {
                "requiredCapabilities": {
                    "extensions": {main.TASKS_EXTENSION: {}}
                }
            },
        )

    def test_task_is_durable_before_handle_is_returned(self) -> None:
        created = self.create_task()
        task_id = created["result"]["taskId"]
        reloaded = main.TaskService(self.directory)
        fetched = reloaded.dispatch(
            main.make_request(2, "tasks/get", {"taskId": task_id})
        )
        self.assertEqual(fetched["result"]["taskId"], task_id)
        self.assertEqual(fetched["result"]["status"], "working")

    def test_task_owner_is_checked_on_every_lookup(self) -> None:
        task_id = self.create_task()["result"]["taskId"]
        response = self.service.dispatch(
            main.make_request(2, "tasks/get", {"taskId": task_id}),
            principal="other-user",
        )
        self.assertEqual(response["error"]["code"], -32602)
        self.assertEqual(response["error"]["message"], "task not found")

    def test_tasks_get_uses_complete_discriminator(self) -> None:
        created = self.create_task()
        fetched = self.service.dispatch(
            main.make_request(
                2,
                "tasks/get",
                {"taskId": created["result"]["taskId"]},
            )
        )
        self.assertEqual(fetched["result"]["resultType"], "complete")

    def test_input_required_is_fulfilled_through_tasks_update(self) -> None:
        task_id = self.create_task()["result"]["taskId"]
        self.service.advance_worker(task_id)
        waiting = self.service.dispatch(
            main.make_request(2, "tasks/get", {"taskId": task_id})
        )
        self.assertEqual(waiting["result"]["status"], "input_required")
        self.assertIn("approve_outline", waiting["result"]["inputRequests"])

        acknowledged = self.service.dispatch(
            main.make_request(
                3,
                "tasks/update",
                {
                    "taskId": task_id,
                    "inputResponses": {
                        "approve_outline": {
                            "action": "accept",
                            "content": {"approved": True},
                        }
                    },
                },
            )
        )
        self.assertEqual(
            acknowledged["result"],
            {"resultType": "complete", "_meta": main._server_meta()},
        )
        self.assertEqual(self.service.store.get(task_id).status, "working")

    def test_completed_task_inlines_original_tool_result(self) -> None:
        task_id = self.create_task()["result"]["taskId"]
        self.service.advance_worker(task_id)
        self.service.dispatch(
            main.make_request(
                2,
                "tasks/update",
                {
                    "taskId": task_id,
                    "inputResponses": {
                        "approve_outline": {
                            "action": "accept",
                            "content": {"approved": True},
                        }
                    },
                },
            )
        )
        self.service.advance_worker(task_id)
        fetched = self.service.dispatch(
            main.make_request(3, "tasks/get", {"taskId": task_id})
        )
        self.assertEqual(fetched["result"]["status"], "completed")
        nested_result = fetched["result"]["result"]
        self.assertEqual(nested_result["resultType"], "complete")
        self.assertFalse(nested_result["isError"])
        self.assertEqual(nested_result["_meta"], main._server_meta())
        self.assertEqual(
            nested_result["structuredContent"]["size"],
            "large",
        )

    def test_http_task_methods_mirror_task_id_as_mcp_name(self) -> None:
        task_id = "tsk_example"
        cases = [
            ("tasks/get", {"taskId": task_id}),
            (
                "tasks/update",
                {"taskId": task_id, "inputResponses": {}},
            ),
            ("tasks/cancel", {"taskId": task_id}),
        ]
        for request_id, (method, params) in enumerate(cases, start=1):
            body, headers = main.make_http_request(request_id, method, params)
            self.assertEqual(body["params"]["taskId"], task_id)
            self.assertEqual(headers["Mcp-Method"], method)
            self.assertEqual(headers["Mcp-Name"], task_id)

    def test_unknown_input_response_is_ignored(self) -> None:
        task_id = self.create_task()["result"]["taskId"]
        self.service.advance_worker(task_id)
        acknowledged = self.service.dispatch(
            main.make_request(
                2,
                "tasks/update",
                {"taskId": task_id, "inputResponses": {"unknown": {"value": 1}}},
            )
        )
        self.assertEqual(acknowledged["result"]["resultType"], "complete")
        self.assertEqual(self.service.store.get(task_id).status, "input_required")

    def test_cancel_is_acknowledged_and_idempotent(self) -> None:
        task_id = self.create_task()["result"]["taskId"]
        first = self.service.dispatch(
            main.make_request(2, "tasks/cancel", {"taskId": task_id})
        )
        second = self.service.dispatch(
            main.make_request(3, "tasks/cancel", {"taskId": task_id})
        )
        self.assertEqual(first["result"]["resultType"], "complete")
        self.assertEqual(second["result"]["resultType"], "complete")
        self.assertEqual(self.service.store.get(task_id).status, "cancelled")

    def test_removed_legacy_task_methods_are_not_found(self) -> None:
        for request_id, method in enumerate(
            ["tasks/status", "tasks/result", "tasks/list"],
            start=10,
        ):
            response = self.service.dispatch(
                main.make_request(request_id, method, {"taskId": "unused"})
            )
            self.assertEqual(response["error"]["code"], -32601)

    def test_notification_helpers_use_current_methods(self) -> None:
        task_id = self.create_task()["result"]["taskId"]
        subscription_id = "listen-13"
        acknowledgement = self.service.subscription_acknowledgement(
            [task_id],
            subscription_id=subscription_id,
        )
        notification = self.service.task_notification(
            task_id,
            subscription_id=subscription_id,
        )
        self.assertEqual(
            acknowledgement["method"],
            "notifications/subscriptions/acknowledged",
        )
        self.assertEqual(notification["method"], "notifications/tasks")
        self.assertEqual(
            acknowledgement["params"]["_meta"][main.SUBSCRIPTION_ID_META],
            subscription_id,
        )
        self.assertEqual(
            notification["params"]["_meta"][main.SUBSCRIPTION_ID_META],
            subscription_id,
        )

    def test_unsupported_protocol_version_is_rejected(self) -> None:
        request = main.make_request(1, "server/discover", {})
        request["params"]["_meta"][main.PROTOCOL_META] = "2025-11-25"
        response = self.service.dispatch(request)
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(
            response["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": "2025-11-25"},
        )

    def test_non_string_protocol_version_is_invalid_params(self) -> None:
        request = main.make_request(1, "server/discover", {})
        request["params"]["_meta"][main.PROTOCOL_META] = None
        response = self.service.dispatch(request)
        self.assertEqual(response["error"]["code"], -32602)

    def test_notification_never_receives_a_json_rpc_response(self) -> None:
        request = main.make_request(9, "tasks/get", {"taskId": "missing"})
        del request["id"]
        self.assertIsNone(self.service.dispatch(request))


if __name__ == "__main__":
    unittest.main()
