import io
import json
import sys
import unittest
import urllib.error
from email.message import Message
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
import parallel_search as example


class Response(io.BytesIO):
    def __init__(self, body=b"", media_type="application/json", status=200, session=None):
        super().__init__(body)
        self.status = status
        self.headers = Message()
        self.headers["Content-Type"] = media_type
        if session:
            self.headers["Mcp-Session-Id"] = session


class ParallelTests(unittest.TestCase):
    def test_client_routes_search_fetch_with_endpoint_headers_and_timeouts(self):
        requests = []
        fake = main.LegacyFakeServer("parallel", [main.tool("web_search", "search"), main.tool("web_fetch", "fetch")])
        def open_request(request, timeout):
            message = json.loads(request.data)
            requests.append((request, timeout, message))
            result = fake(message, int(timeout * 1000))
            if result is None:
                return Response(status=202)
            return Response(json.dumps(result).encode(), session="test-session" if message["method"] == "initialize" else None)
        with patch.object(example.urllib.request.OpenerDirector, "open", side_effect=open_request):
            client = example.connect_parallel()
            for name in ("web_search", "web_fetch"):
                self.assertFalse(client.call(name, {"session_id": "same-conversation"})["isError"])
        self.assertEqual(client.peers["parallel"].era, "legacy")
        self.assertEqual([x[2]["method"] for x in requests], ["server/discover", "initialize", "notifications/initialized", "tools/list", "tools/call", "tools/call"])
        for request, timeout, message in requests:
            self.assertEqual(request.full_url, example.ENDPOINT)
            self.assertEqual(request.get_header("User-agent"), example.USER_AGENT)
            self.assertIsNone(request.get_header("Authorization"))
            self.assertEqual(request.get_method(), "POST")
            self.assertGreater(timeout, 0)
            if message["method"] == "server/discover":
                self.assertIsNone(request.get_header("Mcp-protocol-version"))
            if message["method"] not in ("server/discover", "initialize"):
                self.assertEqual(request.get_header("Mcp-session-id"), "test-session")
                self.assertEqual(request.get_header("Mcp-protocol-version"), main.LEGACY_VERSION)
        self.assertEqual([x[1] for x in requests[:2]], [10.0, 10.0])

    def test_sse_skips_notifications_and_combines_lines(self):
        body = b': keepalive\n\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\ndata: {"jsonrpc":"2.0","id":7,\ndata: "result":{"tools":[]}}\n\n'
        transport = example.ParallelTransport()
        with patch.object(transport.opener, "open", return_value=Response(body, "text/event-stream")):
            result = transport({"id": 7, "method": "tools/list"})
        self.assertEqual(result["result"], {"tools": []})

    def test_sse_missing_response_fails(self):
        with self.assertRaisesRegex(RuntimeError, "without the requested response"):
            example.ParallelTransport._read_sse(io.BytesIO(b': keepalive\n\n'), 1, float('inf'))

    def test_size_is_bounded(self):
        transport = example.ParallelTransport()
        with patch.object(example, "MAX_RESPONSE_BYTES", 10), patch.object(transport.opener, "open", return_value=Response(b' ' * 11)):
            with self.assertRaisesRegex(RuntimeError, "size limit"):
                transport({"id": 1, "method": "tools/list"})

    def test_http_rpc_error_is_returned(self):
        transport = example.ParallelTransport()
        headers = Message()
        headers["Content-Type"] = "application/json"
        error = urllib.error.HTTPError(example.ENDPOINT, 400, "Bad request", headers, io.BytesIO(b'{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"invalid"}}'))
        with patch.object(transport.opener, "open", side_effect=error):
            self.assertEqual(transport({"id": 1, "method": "server/discover"})["error"]["code"], -32602)

    def test_rate_limit_does_not_retry(self):
        transport = example.ParallelTransport()
        headers = Message()
        headers["Retry-After"] = "60"
        error = urllib.error.HTTPError(example.ENDPOINT, 429, "Too many requests", headers, io.BytesIO())
        with patch.object(transport.opener, "open", side_effect=error) as opened:
            with self.assertRaisesRegex(RuntimeError, "Retry-After=60"):
                transport({"id": 1, "method": "tools/list"})
            opened.assert_called_once()

    def test_redirects_are_not_followed(self):
        self.assertIsNone(example.NoRedirects().redirect_request(None, None, 307, "redirect", {}, "https://other.example/mcp"))

    def test_unexpected_content_type_fails(self):
        transport = example.ParallelTransport()
        with patch.object(transport.opener, "open", return_value=Response(b'html', "text/html")):
            with self.assertRaisesRegex(RuntimeError, "content type"):
                transport({"id": 1, "method": "tools/list"})


if __name__ == "__main__":
    unittest.main()
