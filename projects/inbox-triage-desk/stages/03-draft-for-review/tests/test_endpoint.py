import io
import os
import threading
import unittest
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from main import provider_proposal


def call_provider(endpoint):
    return provider_proposal(
        {"text": "Please print two signs."},
        endpoint,
        "fixture-model",
        "synthetic-test-token",
    )


class EndpointTests(unittest.TestCase):
    def test_remote_http_and_malformed_authorities_fail_before_transport(self):
        endpoints = [
            "http://provider.example.invalid/v1",
            "http://localhost.evil.invalid/v1",
            "http://127.0.0.1.example.invalid/v1",
            "http://2130706433/v1",
            "http://127.1/v1",
            "https://:443/v1",
            "https://@example.invalid/v1",
            "https://:pass@example.invalid/v1",
            "https://example.invalid:abc/v1",
            "https://example.invalid:65536/v1",
            "https://example.invalid:0/v1",
            "https://example.invalid:/v1",
            "https://[::1]suffix/v1",
            "https://bad\\host/v1",
            "https://bad host/v1",
            " https://example.invalid/v1",
            "https://exam\nple.invalid/v1",
            "https://example.invalid/v1#other",
        ]
        for endpoint in endpoints:
            with (
                self.subTest(endpoint=endpoint),
                patch("urllib.request.OpenerDirector.open") as opened,
            ):
                with self.assertRaises(ValueError):
                    call_provider(endpoint)
                opened.assert_not_called()

    def test_https_and_explicit_loopback_http_are_supported(self):
        for endpoint in [
            "https://provider.example.invalid/v1",
            "http://localhost:1234/v1",
            "http://127.0.0.1/v1",
            "http://127.0.0.2/v1",
            "http://[::1]:8080/v1",
        ]:
            with (
                self.subTest(endpoint=endpoint),
                patch(
                    "urllib.request.OpenerDirector.open",
                    return_value=io.BytesIO(
                        b'{"choices":[{"message":{"content":"{\\"category\\":\\"action\\",\\"quote\\":\\"print two signs\\"}"}}]}'
                    ),
                ) as opened,
            ):
                call_provider(endpoint)
                request = opened.call_args.args[0]
                self.assertEqual(request.full_url, endpoint)
                self.assertEqual(request.get_method(), "POST")
                self.assertEqual(
                    request.get_header("Authorization"), "Bearer synthetic-test-token"
                )

    def test_redirects_never_contact_another_endpoint(self):
        requests = []
        status = [301]

        class Sink(BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.headers.get("Authorization"))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(
                    b'{"choices":[{"message":{"content":"{\\"category\\":\\"action\\",\\"quote\\":\\"print two signs\\"}"}}]}'
                )

            do_POST = do_GET

            def log_message(self, *_):
                pass

        sink = ThreadingHTTPServer(("127.0.0.1", 0), Sink)
        target = "http://127.0.0.1:%d/receive" % sink.server_port

        class Source(Sink):
            def do_POST(self):
                self.rfile.read(int(self.headers["Content-Length"]))
                self.send_response(status[0])
                self.send_header("Location", target)
                self.end_headers()

        source = ThreadingHTTPServer(("127.0.0.1", 0), Source)
        threads = [
            threading.Thread(target=s.serve_forever, kwargs={"poll_interval": 0.01})
            for s in (source, sink)
        ]
        for thread in threads:
            thread.start()
        try:
            with patch.dict(os.environ, {"no_proxy": "*", "NO_PROXY": "*"}):
                for code in (301, 302, 303, 307, 308):
                    status[0] = code
                    with self.subTest(status=code):
                        with self.assertRaises(urllib.error.HTTPError) as caught:
                            call_provider(
                                "http://127.0.0.1:%d/classify" % source.server_port
                            )
                        self.assertEqual(caught.exception.code, code)
                        caught.exception.close()
            self.assertEqual(requests, [])
        finally:
            for server in (source, sink):
                server.shutdown()
                server.server_close()
            for thread in threads:
                thread.join()
