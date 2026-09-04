import json
import shutil
import subprocess
import unittest
from pathlib import Path

import main


TYPESCRIPT_MAIN = Path(__file__).resolve().parents[1] / "main.ts"


class McpServerTests(unittest.TestCase):
    def setUp(self) -> None:
        main.reset_notes()

    def test_discover_is_mandatory_modern_shape(self) -> None:
        response = main.dispatch(main.make_request(1, "server/discover"))
        result = response["result"]
        self.assertEqual(result["supportedVersions"], [main.PROTOCOL_VERSION])
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["cacheScope"], "public")

    def test_missing_request_meta_is_invalid_params(self) -> None:
        message = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        response = main.dispatch(message)
        self.assertEqual(response["error"]["code"], -32602)

    def test_invalid_request_ids_are_rejected_at_the_boundary(self) -> None:
        for request_id in (None, True, 1.5, {"nested": "id"}):
            with self.subTest(request_id=request_id):
                message = main.make_request(2, "tools/list")
                message["id"] = request_id
                response = main.dispatch(message)
                self.assertEqual(response["id"], None)
                self.assertEqual(response["error"]["code"], -32600)

    def test_typescript_ids_are_limited_to_safe_integer_bounds(self) -> None:
        node = shutil.which("node")
        if node is None:
            self.skipTest("Node.js is unavailable")
        version = subprocess.run(
            [node, "--version"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        version_parts = version.removeprefix("v").split("-", 1)[0].split(".")
        node_version = tuple(int(part) for part in version_parts[:3])
        if len(node_version) < 3 or node_version < (22, 6, 0):
            self.skipTest("Node.js 22.6.0+ is required for TypeScript strip mode")

        accepted = [-(2**53 - 1), 2**53 - 1]
        rejected = [-(2**53), 2**53, 1.5, True]
        messages = []
        for request_id in accepted + rejected:
            message = main.make_request(1, "tools/list")
            message["id"] = request_id
            messages.append(json.dumps(message, separators=(",", ":")))

        completed = subprocess.run(
            [node, "--no-warnings", "--experimental-strip-types", str(TYPESCRIPT_MAIN)],
            input="\n".join(messages) + "\n",
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        responses = [json.loads(line) for line in completed.stdout.splitlines()]
        self.assertEqual(len(responses), len(messages), completed.stderr or completed.stdout)
        self.assertEqual([response["id"] for response in responses[:2]], accepted)
        for response in responses[2:]:
            self.assertIsNone(response["id"])
            self.assertEqual(response["error"]["code"], -32600)

    def test_unsupported_version_is_modern_error(self) -> None:
        response = main.dispatch(main.make_request(3, "tools/list", version="2027-01-01"))
        self.assertEqual(response["error"]["code"], -32022)
        self.assertEqual(response["error"]["data"]["supported"], [main.PROTOCOL_VERSION])

    def test_all_list_results_are_sorted_and_cacheable(self) -> None:
        for request_id, method, key in (
            (4, "tools/list", "tools"),
            (5, "resources/list", "resources"),
            (6, "prompts/list", "prompts"),
        ):
            result = main.dispatch(main.make_request(request_id, method))["result"]
            field = "uri" if key == "resources" else "name"
            values = [item[field] for item in result[key]]
            self.assertEqual(values, sorted(values))
            self.assertIn("ttlMs", result)
            self.assertIn(result["cacheScope"], {"private", "public"})

    def test_every_success_has_server_identity(self) -> None:
        for request_id, method in ((7, "tools/list"), (8, "resources/list"), (9, "prompts/list")):
            result = main.dispatch(main.make_request(request_id, method))["result"]
            self.assertEqual(result["resultType"], "complete")
            self.assertEqual(result["_meta"][main.SERVER_INFO_KEY], main.SERVER_INFO)

    def test_create_then_read_returns_private_cacheable_resource(self) -> None:
        create = main.dispatch(
            main.make_request(
                10,
                "tools/call",
                {"name": "notes_create", "arguments": {"title": "New", "body": "Body"}},
            )
        )["result"]
        uri = create["content"][1]["resource"]["uri"]
        read = main.dispatch(main.make_request(11, "resources/read", {"uri": uri}))["result"]
        self.assertEqual(read["resultType"], "complete")
        self.assertEqual(read["cacheScope"], "private")
        self.assertIn("Body", read["contents"][0]["text"])

    def test_unknown_tool_is_tool_level_error(self) -> None:
        result = main.dispatch(
            main.make_request(12, "tools/call", {"name": "missing", "arguments": {}})
        )["result"]
        self.assertTrue(result["isError"])
        self.assertEqual(result["resultType"], "complete")

    def test_initialize_is_not_a_modern_handler(self) -> None:
        response = main.dispatch(main.make_request(13, "initialize"))
        self.assertEqual(response["error"]["code"], -32601)


if __name__ == "__main__":
    unittest.main()
