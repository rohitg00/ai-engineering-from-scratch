import json, os, subprocess, sys, tempfile, threading, unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class ModelWire(unittest.TestCase):
    def exercise(self, sql):
        requests = []
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                requests.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
                payload = json.dumps({'choices': [{'message': {'content': sql}}]}).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            def log_message(self, *args):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp:
                work = Path(os.environ['PROJECT_WORKSPACE'])
                output = Path(temp) / 'answer.html'
                env = dict(os.environ, MODEL_URL=f'http://127.0.0.1:{server.server_port}/v1/chat/completions', MODEL_NAME='wire-fixture')
                env.pop('MODEL_API_KEY', None)
                result = subprocess.run([sys.executable, str(work/'cli.py'), str(work/'sample.csv'), '--question', 'How many rows?', '--model', '--output', str(output)], env=env, capture_output=True, text=True, timeout=10)
                receipt = json.loads(output.with_suffix('.json').read_text()) if output.exists() else None
                return result, requests, receipt
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
    def test_real_http_proposal_uses_same_receipt(self):
        result, requests, receipt = self.exercise('SELECT COUNT(*) AS count FROM data')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(receipt['rows'], [[6]])
        prompt = json.loads(requests[0]['messages'][1]['content'])
        self.assertIn('schema', prompt)
        self.assertNotIn('rows', prompt)
    def test_external_write_proposal_is_denied(self):
        result, requests, receipt = self.exercise('DELETE FROM data')
        self.assertEqual(result.returncode, 2)
        self.assertEqual(len(requests), 1)
        self.assertIsNone(receipt)
