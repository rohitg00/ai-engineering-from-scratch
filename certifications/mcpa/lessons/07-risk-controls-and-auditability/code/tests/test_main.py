import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class AuditTrailTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.AuditedClient(server=main.build_support_server())

    def test_append_creates_one_log_entry_per_call(self) -> None:
        log = main.AuditLog()
        log.append(tool="lookup_order", arguments={"order_id": "A1"}, result="shipped")
        self.assertEqual(len(log.entries), 1)
        log.append(tool="lookup_order", arguments={"order_id": "A2"}, result="shipped")
        self.assertEqual(len(log.entries), 2)

    def test_hash_chain_links_consecutive_entries(self) -> None:
        log = main.AuditLog()
        log.append(tool="a", arguments={}, result="1")
        log.append(tool="b", arguments={}, result="2")
        self.assertEqual(log.entries[0].prev_hash, main.GENESIS_HASH)
        self.assertEqual(log.entries[1].prev_hash, log.entries[0].hash)
        self.assertNotEqual(log.entries[0].hash, log.entries[1].hash)

    def test_verify_passes_on_an_untampered_chain(self) -> None:
        log = main.AuditLog()
        log.append(tool="a", arguments={"x": 1}, result="1")
        log.append(tool="b", arguments={"y": 2}, result="2")
        log.append(tool="c", arguments={"z": 3}, result="3")
        ok, broken_at = log.verify()
        self.assertTrue(ok)
        self.assertIsNone(broken_at)

    def test_tampering_a_past_entry_breaks_verification(self) -> None:
        log = main.AuditLog()
        log.append(tool="a", arguments={"x": 1}, result="1")
        log.append(tool="b", arguments={"y": 2}, result="2")
        log.entries[0].arguments = {"x": 999}
        ok, broken_at = log.verify()
        self.assertFalse(ok)
        self.assertEqual(broken_at, 0)

    def test_entry_order_is_preserved(self) -> None:
        log = main.AuditLog()
        for name in ("first", "second", "third"):
            log.append(tool=name, arguments={}, result="ok")
        self.assertEqual([entry.tool for entry in log.entries], ["first", "second", "third"])
        self.assertEqual([entry.index for entry in log.entries], [0, 1, 2])

    def test_flagged_field_is_redacted_in_the_log(self) -> None:
        response = self.client.call_tool("reset_password", {"user_id": "u42", "new_password": "hunter2"})
        self.assertNotIn("error", response)
        entry = self.client.server.log.entries[-1]
        self.assertEqual(entry.arguments["new_password"], main.REDACTED)
        self.assertEqual(entry.arguments["user_id"], "u42")

    def test_unknown_tool_is_denied_and_not_logged(self) -> None:
        response = self.client.call_tool("delete_account", {})
        self.assertEqual(response["error"]["code"], main.METHOD_NOT_FOUND)
        self.assertEqual(len(self.client.server.log.entries), 0)

    def test_missing_required_argument_is_rejected(self) -> None:
        response = self.client.call_tool("reset_password", {"user_id": "u42"})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)
        self.assertEqual(len(self.client.server.log.entries), 0)

    def test_rate_limit_denies_calls_past_the_cap(self) -> None:
        self.client.server.rate_limit_per_tool = 2
        self.client.call_tool("lookup_order", {"order_id": "A100"})
        self.client.call_tool("lookup_order", {"order_id": "A100"})
        third = self.client.call_tool("lookup_order", {"order_id": "A100"})
        self.assertEqual(third["error"]["code"], main.TOOL_DENIED)
        self.assertEqual(len(self.client.server.log.entries), 2)

    def test_malformed_request_is_rejected_by_the_server(self) -> None:
        response = self.client.server.handle({"method": "tools/call", "id": 1})
        self.assertEqual(response["error"]["code"], main.INVALID_REQUEST)


if __name__ == "__main__":
    unittest.main()
