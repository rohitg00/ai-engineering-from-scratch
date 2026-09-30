import base64
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class ResourcePrimitiveTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.Client(main.build_workspace_server())

    def test_resources_list_returns_catalog_with_cache_hints(self) -> None:
        result = self.client.send("resources/list")["result"]
        uris = [entry["uri"] for entry in result["resources"]]
        self.assertIn("file:///project/README.md", uris)
        self.assertEqual(uris, sorted(uris))
        self.assertGreaterEqual(result["ttlMs"], 0)
        self.assertEqual(result["cacheScope"], "public")

    def test_template_expands_reserved_path_and_reads_the_file(self) -> None:
        template = self.client.send("resources/templates/list")["result"]["resourceTemplates"][0]
        self.assertEqual(template["uriTemplate"], "file:///project/{+path}")
        response = self.client.read_template(template["uriTemplate"], path="src/utils.py")
        self.assertNotIn("error", response)
        content = response["result"]["contents"][0]
        self.assertEqual(content["uri"], "file:///project/src/utils.py")
        self.assertIn("def slugify", content["text"])

    def test_binary_resource_returns_base64_blob(self) -> None:
        response = self.client.read("file:///project/assets/logo.png")
        content = response["result"]["contents"][0]
        self.assertNotIn("text", content)
        decoded = base64.b64decode(content["blob"])
        self.assertEqual(decoded, main.LOGO_BYTES)

    def test_missing_resource_is_invalid_params_with_uri(self) -> None:
        response = self.client.read("file:///project/missing.md")
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(response["error"]["data"]["uri"], "file:///project/missing.md")

    def test_path_traversal_outside_root_is_refused(self) -> None:
        malicious = "file:///project/../../../../etc/passwd"
        response = self.client.read(malicious)
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(response["error"]["data"]["uri"], malicious)

    def test_resource_read_carries_ttl_and_cache_scope(self) -> None:
        response = self.client.read("file:///project/README.md")
        result = response["result"]
        self.assertIsInstance(result["ttlMs"], int)
        self.assertGreaterEqual(result["ttlMs"], 0)
        self.assertIn(result["cacheScope"], {"public", "private"})

    def test_directory_read_returns_multiple_contents(self) -> None:
        response = self.client.read("file:///project/src")
        contents = response["result"]["contents"]
        self.assertEqual(len(contents), 2)
        uris = {entry["uri"] for entry in contents}
        self.assertEqual(uris, {"file:///project/src/app.py", "file:///project/src/utils.py"})

    def test_private_resource_uses_private_cache_scope(self) -> None:
        response = self.client.read("user://alice/notes/welcome")
        result = response["result"]
        self.assertEqual(result["cacheScope"], "private")
        self.assertLessEqual(result["ttlMs"], 60000)

    def test_request_without_meta_is_rejected(self) -> None:
        server = main.build_workspace_server()
        response = server.handle({"jsonrpc": "2.0", "id": 1, "method": "resources/list", "params": {}})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_unsupported_version_is_rejected_before_lookup(self) -> None:
        response = self.client.send("resources/list", version="1999-01-01")
        error = response["error"]
        self.assertEqual(error["code"], main.UNSUPPORTED_PROTOCOL_VERSION)
        self.assertEqual(error["data"]["supported"], [main.PROTOCOL_VERSION])


if __name__ == "__main__":
    unittest.main()
