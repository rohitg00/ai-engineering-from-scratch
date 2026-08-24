import http.client
import json
import subprocess
import sys
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import main


MAIN_PATH = Path(__file__).resolve().parents[1] / "main.py"


class StreamableHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = main.serve()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/mcp"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def raw_post(
        self,
        headers: list[tuple[str, str]],
        body: bytes = b"",
    ) -> tuple[int, dict]:
        connection = http.client.HTTPConnection(
            "127.0.0.1",
            self.server.server_port,
            timeout=3,
        )
        connection.putrequest("POST", "/mcp")
        for name, value in headers:
            connection.putheader(name, value)
        connection.endheaders()
        if body:
            connection.send(body)
        response = connection.getresponse()
        payload = json.loads(response.read())
        status = response.status
        connection.close()
        return status, payload

    def test_invalid_origin_is_rejected(self) -> None:
        message = main.make_request(1, "server/discover")
        status, _, payload = main.post(
            self.url,
            message,
            main.http_headers_for(message, origin="http://evil.example"),
        )
        self.assertEqual(status, 403)
        self.assertEqual(payload["error"], "Origin not allowed")

    def test_duplicate_origin_is_rejected_before_allowlist_evaluation(self) -> None:
        message = main.make_request(11, "server/discover")
        body = json.dumps(message).encode("utf-8")
        headers = [
            (name, value)
            for name, value in main.http_headers_for(message).items()
            if name.lower() != "origin"
        ]
        headers.extend(
            [
                ("Origin", "http://localhost"),
                ("Origin", "http://evil.example"),
                ("Content-Length", str(len(body))),
            ]
        )

        status, payload = self.raw_post(headers, body)

        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32020)
        self.assertEqual(payload["error"]["message"], "Duplicate Origin header")

    def test_discovery_has_no_protocol_session(self) -> None:
        message = main.make_request(2, "server/discover")
        status, headers, payload = main.post(self.url, message, main.http_headers_for(message))
        result = payload["result"]
        self.assertEqual(status, 200)
        self.assertIsNone(headers.get("Mcp-Session-Id"))
        self.assertEqual(result["resultType"], "complete")
        self.assertEqual(result["_meta"][main.SERVER_INFO_KEY], main.SERVER_INFO)

    def test_removed_session_and_replay_headers_are_ignored(self) -> None:
        message = main.make_request(3, "tools/list")
        headers = main.http_headers_for(
            message,
            extra={"Mcp-Session-Id": "old-session", "Last-Event-ID": "99"},
        )
        status, response_headers, payload = main.post(self.url, message, headers)
        self.assertEqual(status, 200)
        self.assertIsNone(response_headers.get("Mcp-Session-Id"))
        self.assertEqual(payload["result"]["tools"][0]["name"], "ping")

    def test_header_mismatch_is_modern_error(self) -> None:
        message = main.make_request(4, "tools/list")
        headers = main.http_headers_for(message)
        headers["Mcp-Method"] = "tools/call"
        status, _, payload = main.post(self.url, message, headers)
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32020)

    def test_conflicting_duplicate_name_headers_are_rejected(self) -> None:
        message = main.make_request(
            41,
            "tools/call",
            {"name": "ping", "arguments": {}},
        )
        body = json.dumps(message).encode("utf-8")
        headers = [
            (name, value)
            for name, value in main.http_headers_for(message).items()
            if name.lower() != "mcp-name"
        ]
        headers.extend(
            [
                ("Mcp-Name", "ping"),
                ("Mcp-Name", "different-tool"),
                ("Content-Length", str(len(body))),
            ]
        )
        status, payload = self.raw_post(headers, body)
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32020)

    def test_invalid_and_oversized_content_lengths_are_rejected(self) -> None:
        message = main.make_request(42, "tools/list")
        base_headers = list(main.http_headers_for(message).items())
        for content_length in (None, "not-a-number", "-1", str(main.MAX_REQUEST_BYTES + 1)):
            with self.subTest(content_length=content_length):
                headers = base_headers.copy()
                if content_length is not None:
                    headers.append(("Content-Length", content_length))
                status, payload = self.raw_post(headers)
                self.assertEqual(status, 400)
                self.assertEqual(payload["error"]["code"], -32700)

    def test_content_length_accepts_only_ascii_decimal_digits(self) -> None:
        message = main.make_request(421, "tools/list")
        base_headers = list(main.http_headers_for(message).items())
        for content_length in ("+1", "1.0", "\u00b2"):
            with self.subTest(content_length=content_length):
                headers = base_headers + [("Content-Length", content_length)]
                status, payload = self.raw_post(headers, b"{")
                self.assertEqual(status, 400)
                self.assertEqual(payload["error"]["code"], -32700)
                self.assertEqual(
                    payload["error"]["data"]["detail"],
                    "Content-Length must contain ASCII decimal digits",
                )

    def test_conflicting_content_lengths_are_rejected_before_body_read(self) -> None:
        message = main.make_request(43, "tools/list")
        headers = list(main.http_headers_for(message).items())
        headers.extend(
            [
                ("Content-Length", "10"),
                ("Content-Length", "20"),
            ]
        )

        status, payload = self.raw_post(headers)

        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32700)
        self.assertIn("duplicate Content-Length", payload["error"]["data"]["detail"])

    def test_content_length_with_transfer_encoding_is_rejected_before_body_read(self) -> None:
        message = main.make_request(44, "tools/list")
        headers = list(main.http_headers_for(message).items())
        headers.extend(
            [
                ("Content-Length", "10"),
                ("Transfer-Encoding", "chunked"),
            ]
        )

        status, payload = self.raw_post(headers)

        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32700)
        self.assertIn("Transfer-Encoding", payload["error"]["data"]["detail"])

    def test_unsupported_matching_version_advertises_supported(self) -> None:
        message = main.make_request(5, "tools/list", version="2027-01-01")
        status, _, payload = main.post(self.url, message, main.http_headers_for(message))
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32022)
        self.assertEqual(
            payload["error"]["data"],
            {"supported": [main.PROTOCOL_VERSION], "requested": "2027-01-01"},
        )

    def test_accepted_notification_returns_202_without_a_body(self) -> None:
        message = main.make_request(6, "tools/list")
        del message["id"]
        status, _, payload = main.post(self.url, message, main.http_headers_for(message))
        self.assertEqual(status, 202)
        self.assertEqual(payload, "")

    def test_non_string_protocol_version_is_invalid_params(self) -> None:
        message = main.make_request(6, "tools/list")
        message["params"]["_meta"][main.VERSION_KEY] = None
        status, _, payload = main.post(self.url, message, main.http_headers_for(message))
        self.assertEqual(status, 400)
        self.assertEqual(payload["error"]["code"], -32602)

    def test_get_and_delete_return_405(self) -> None:
        for method in ("GET", "DELETE"):
            request = urllib.request.Request(
                self.url,
                headers={"Origin": "http://localhost"},
                method=method,
            )
            try:
                urllib.request.urlopen(request, timeout=3)
            except urllib.error.HTTPError as exc:
                status = exc.code
                allow = exc.headers.get("Allow")
                exc.close()
            else:
                self.fail(f"{method} unexpectedly succeeded")
            self.assertEqual(status, 405)
            self.assertEqual(allow, "POST")

    def test_tool_list_is_cacheable_and_deterministic(self) -> None:
        message = main.make_request(6, "tools/list")
        _, _, payload = main.post(self.url, message, main.http_headers_for(message))
        result = payload["result"]
        names = [tool["name"] for tool in result["tools"]]
        self.assertEqual(names, sorted(names))
        self.assertEqual(result["ttlMs"], 30_000)
        self.assertEqual(result["cacheScope"], "public")

    def test_base64_name_is_decoded_before_comparison(self) -> None:
        message = main.make_request(
            7,
            "tools/call",
            {"name": "ping-世界", "arguments": {}},
        )
        status, _, payload = main.post(self.url, message, main.http_headers_for(message))
        self.assertEqual(status, 200)
        self.assertTrue(payload["result"]["isError"])

    def test_subscriptions_listen_is_post_scoped_sse(self) -> None:
        message = main.make_request(
            "listen-8",
            "subscriptions/listen",
            {"notifications": {"toolsListChanged": True}},
        )
        status, headers, stream = main.post(self.url, message, main.http_headers_for(message))
        self.assertEqual(status, 200)
        self.assertEqual(headers.get_content_type(), "text/event-stream")
        self.assertIn("notifications/subscriptions/acknowledged", stream)
        self.assertIn(main.SUBSCRIPTION_ID_KEY, stream)
        self.assertNotIn("\nid:", stream)
        payloads = [
            json.loads(line.removeprefix("data: "))
            for line in stream.splitlines()
            if line.startswith("data: ")
        ]
        self.assertEqual(payloads[-1]["result"]["resultType"], "complete")
        self.assertEqual(
            payloads[-1]["result"]["_meta"][main.SUBSCRIPTION_ID_KEY],
            "listen-8",
        )

    def test_default_command_runs_the_finite_probe(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(MAIN_PATH)],
            cwd=MAIN_PATH.parent,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("MCP 2026-07-28 Streamable HTTP probe", completed.stdout)


if __name__ == "__main__":
    unittest.main()
