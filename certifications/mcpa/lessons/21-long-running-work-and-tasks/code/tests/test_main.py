import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class TasksExtensionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = main.Server("pipelines")
        self.client = main.Client(self.server)

    def _create(self, project: str = "web-storefront", environment: str = "production", with_tasks: bool = True) -> dict:
        capabilities = main.TASKS_CAPS if with_tasks else None
        return self.client.send(
            "tools/call",
            {"name": main.TOOL_NAME, "arguments": {"project": project, "environment": environment}},
            capabilities=capabilities,
        )

    def test_without_the_extension_a_plain_result_returns(self) -> None:
        response = self._create(with_tasks=False)
        self.assertNotIn("error", response)
        self.assertEqual(response["result"]["resultType"], "complete")
        self.assertFalse(response["result"]["structuredContent"]["deployed"])

    def test_with_the_extension_a_task_handle_returns(self) -> None:
        response = self._create(with_tasks=True)
        self.assertEqual(response["result"]["resultType"], "task")
        self.assertIn("taskId", response["result"])
        self.assertEqual(response["result"]["status"], "working")

    def test_polling_shows_status_progression(self) -> None:
        task_id = self._create()["result"]["taskId"]
        first = self.client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(first["result"]["status"], "working")
        self.server.advance_task(task_id)
        second = self.client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(second["result"]["status"], "input_required")

    def test_input_required_surfaces_input_requests(self) -> None:
        task_id = self._create()["result"]["taskId"]
        self.server.advance_task(task_id)
        response = self.client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        requests = response["result"]["inputRequests"]
        self.assertIn("approve_deploy", requests)
        self.assertEqual(requests["approve_deploy"]["method"], "elicitation/create")

    def test_tasks_update_resumes_the_task(self) -> None:
        task_id = self._create()["result"]["taskId"]
        self.server.advance_task(task_id)
        ack = self.client.send(
            "tasks/update",
            {"taskId": task_id, "inputResponses": {"approve_deploy": {"action": "accept", "content": {"approved": True}}}},
            capabilities=main.TASKS_CAPS,
        )
        self.assertEqual(ack["result"], {"resultType": "complete"})
        after = self.client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(after["result"]["status"], "working")
        self.assertNotIn("inputRequests", after["result"])

    def test_completed_carries_the_original_result_shape(self) -> None:
        task_id = self._create()["result"]["taskId"]
        self.server.advance_task(task_id)
        self.client.send(
            "tasks/update",
            {"taskId": task_id, "inputResponses": {"approve_deploy": {"action": "accept", "content": {"approved": True}}}},
            capabilities=main.TASKS_CAPS,
        )
        self.server.advance_task(task_id)
        response = self.client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(response["result"]["status"], "completed")
        inner = response["result"]["result"]
        self.assertEqual(inner["resultType"], "complete")
        self.assertTrue(inner["structuredContent"]["deployed"])

    def test_cancel_moves_a_working_task_to_cancelled(self) -> None:
        task_id = self._create()["result"]["taskId"]
        ack = self.client.send("tasks/cancel", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(ack["result"], {"resultType": "complete"})
        response = self.client.send("tasks/get", {"taskId": task_id}, capabilities=main.TASKS_CAPS)
        self.assertEqual(response["result"]["status"], "cancelled")

    def test_unknown_task_id_is_a_protocol_error(self) -> None:
        response = self.client.send("tasks/get", {"taskId": "tsk_does_not_exist"}, capabilities=main.TASKS_CAPS)
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_task_method_without_the_capability_is_a_capability_error(self) -> None:
        task_id = self._create()["result"]["taskId"]
        response = self.client.send("tasks/get", {"taskId": task_id})
        self.assertEqual(response["error"]["code"], main.MISSING_REQUIRED_CLIENT_CAPABILITY)
        self.assertIn("extensions", response["error"]["data"]["requiredCapabilities"])

    def test_missing_argument_is_a_tool_execution_error(self) -> None:
        response = self.client.send(
            "tools/call", {"name": main.TOOL_NAME, "arguments": {"project": "web-storefront"}}, capabilities=main.TASKS_CAPS,
        )
        self.assertNotIn("error", response)
        self.assertTrue(response["result"]["isError"])

    def test_every_request_declares_protocol_version_and_capabilities(self) -> None:
        self._create()
        for message in self.client.log:
            if "method" in message:
                meta = message["params"]["_meta"]
                self.assertEqual(meta[main.PV_KEY], main.PROTOCOL_VERSION)
                self.assertIsInstance(meta[main.CAPS_KEY], dict)

    def test_transcript_uses_the_task_result_type_and_stays_internally_consistent(self) -> None:
        entries = main.transcript()
        self.assertGreater(len(entries), 10)
        result_types = {message["result"]["resultType"] for message in entries if "result" in message}
        self.assertIn("task", result_types)
        self.assertEqual(main.EXTENSION_RESULT_TYPES, {"task"})


if __name__ == "__main__":
    unittest.main()
