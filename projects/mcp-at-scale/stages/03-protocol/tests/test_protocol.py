import unittest
import tempfile
from pathlib import Path
from protocol import *


class StageTests(unittest.TestCase):
    def test_01(self):
        self.assertEqual(handle([], {}, {})["error"]["code"], -32600)

    def test_02(self):
        self.assertEqual(
            handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, {}, {})[
                "error"
            ]["code"],
            -32002,
        )

    def test_03(self):
        state = {}
        handle(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {"protocolVersion": "2025-06-18"},
            },
            state,
            {},
        )
        self.assertIsNone(
            handle({"jsonrpc": "2.0", "method": "notifications/initialized"}, state, {})
        )
        self.assertTrue(state["initialized"])

    def test_04(self):
        r = handle(
            {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            {"initialized": True},
            {},
        )
        self.assertEqual(len(r["result"]["tools"]), 32)
        self.assertEqual(r["result"]["nextCursor"], "32")

    def test_05(self):
        r = handle(
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": "pods_count"},
            },
            {"initialized": True},
            {"pods": [{"name": "x"}]},
        )
        self.assertEqual(r["result"]["content"][0]["text"], "1")
