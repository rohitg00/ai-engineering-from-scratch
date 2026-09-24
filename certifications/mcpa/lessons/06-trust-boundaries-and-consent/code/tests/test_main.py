import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main


class TrustBoundaryAndConsentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = main.MockClient(server=main.build_files_server())
        self.client.initialize()

    def test_side_effecting_call_without_consent_is_refused(self) -> None:
        response = self.client.call_tool("delete_file", {"path": "notes.txt"})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.CONSENT_REQUIRED)

    def test_side_effecting_call_with_consent_runs(self) -> None:
        self.client.grant_consent("delete_file", token="user-approved-1")
        response = self.client.call_tool("delete_file", {"path": "notes.txt"})
        self.assertNotIn("error", response)
        self.assertIn("notes.txt", response["result"]["content"][0]["text"])

    def test_read_only_call_runs_without_consent(self) -> None:
        response = self.client.call_tool("list_files", {})
        self.assertNotIn("error", response)
        self.assertIn("report.csv", response["result"]["content"][0]["text"])

    def test_consent_for_one_tool_does_not_authorize_another(self) -> None:
        self.client.grant_consent("delete_file", token="user-approved-1")
        response = self.client.call_tool("send_email", {"to": "ceo@example.com"})
        self.assertNotIn("result", response)
        self.assertEqual(response["error"]["code"], main.CONSENT_REQUIRED)

    def test_tool_result_is_flagged_untrusted(self) -> None:
        response = self.client.call_tool("list_files", {})
        self.assertEqual(response["result"]["content"][0]["trust"], "untrusted")

    def test_missing_required_argument_is_rejected_before_consent_check(self) -> None:
        response = self.client.call_tool("delete_file", {})
        self.assertEqual(response["error"]["code"], main.INVALID_PARAMS)

    def test_response_id_matches_request_id(self) -> None:
        response = self.client.call_tool("list_files", {})
        self.assertEqual(response["id"], 2)


if __name__ == "__main__":
    unittest.main()
