import unittest, os, sys, json, subprocess, tempfile
from pathlib import Path

W = Path(os.environ["PROJECT_WORKSPACE"])
from cli import configured_catalog
from protocol import handle
from discovery import discover


class IntegrationTests(unittest.TestCase):
    def test_actual_serialized_context_stays_in_budget(self):
        r = discover(configured_catalog({"pods": []})[1:], "pods", 700)
        self.assertEqual(
            r["characters"], len(json.dumps(r["tools"], separators=(",", ":")))
        )
        self.assertLessEqual(r["characters"], 700)

    def test_custom_inventory_limits_surface(self):
        self.assertEqual(len(configured_catalog({"pods": []})), 6)

    def test_discovery_tool_runs_over_protocol(self):
        state = {
            "initialized": True,
            "catalog": configured_catalog({"pods": [{"name": "worker"}]}),
        }
        response = handle(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "catalog_search",
                    "arguments": {"query": "pods count", "max_chars": 500},
                },
            },
            state,
            {},
        )
        self.assertEqual(
            json.loads(response["result"]["content"][0]["text"])["tools"][0]["name"],
            "pods_count",
        )

    def test_unknown_inventory_family_rejected(self):
        with self.assertRaises(ValueError):
            configured_catalog({"secret_random": []})

    def test_full_stdio_cli(self):
        requests = [
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"protocolVersion": "2025-11-25"},
            },
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": "pods_count", "arguments": {}},
            },
        ]
        p = subprocess.run(
            [
                sys.executable,
                str(W / "cli.py"),
                str(W / "samples/inventory.json"),
                "--serve",
            ],
            input="\n".join(map(json.dumps, requests)) + "\n",
            capture_output=True,
            text=True,
        )
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(
            json.loads(p.stdout.splitlines()[-1])["result"]["content"][0]["text"], "2"
        )


from rest_adapter import import_openapi, execute_rest


class ImportedAPIContracts(unittest.TestCase):
    def tool(self):
        return import_openapi(json.loads((W / "samples/api.json").read_text()))[0]

    def test_only_get_is_imported(self):
        spec = json.loads((W / "samples/api.json").read_text())
        spec["paths"]["/incidents/{id}"]["delete"] = {"operationId": "incident_delete"}
        self.assertEqual(len(import_openapi(spec)), 1)

    def test_recording_retains_schema_fingerprint(self):
        r = execute_rest(
            self.tool(),
            {"id": "checkout-1"},
            json.loads((W / "samples/api-recordings.json").read_text())["recordings"],
        )
        self.assertEqual(len(r["source_sha256"]), 64)
        self.assertEqual(r["value"]["error_count"], 12)

    def test_recording_arguments_must_match(self):
        with self.assertRaises(ValueError):
            execute_rest(
                self.tool(),
                {"id": "other"},
                json.loads((W / "samples/api-recordings.json").read_text())[
                    "recordings"
                ],
            )

    def test_unknown_argument_rejected(self):
        with self.assertRaises(ValueError):
            execute_rest(self.tool(), {"id": "checkout-1", "extra": True}, {})

    def test_live_target_is_loopback_only(self):
        with self.assertRaises(ValueError):
            execute_rest(
                self.tool(), {"id": "checkout-1"}, base_url="https://public.example"
            )
