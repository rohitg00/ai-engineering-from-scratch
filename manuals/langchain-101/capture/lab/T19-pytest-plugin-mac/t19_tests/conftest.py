import json
import os
import socket
import sys
import traceback

GUARD = os.environ.get("T19_GUARD")
LOG = os.environ.get("T19_LOG")


def _log(entry):
    if LOG:
        with open(LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")


if GUARD:
    _real_gai = socket.getaddrinfo

    def _gai(host, *a, **k):
        if host not in ("127.0.0.1", "localhost", "::1"):
            _log({"kind": "getaddrinfo-blocked", "host": host})
            raise socket.gaierror(f"blocked by t19 guard: {host}")
        return _real_gai(host, *a, **k)

    socket.getaddrinfo = _gai

    import requests

    def _send(self, request, **kw):
        stack = [l.strip() for l in traceback.format_stack(limit=12)[:-1] if "langsmith" in l]
        _log({"kind": "requests-send", "method": request.method, "url": request.url.split("?")[0], "guard": GUARD,
              "where": stack[-1].split(", in ")[-1] if stack else None, "frames": [s.split("site-packages/")[-1][:120] for s in stack[-4:]]})
        if GUARD == "refuse":
            raise requests.ConnectionError(f"t19 guard refused {request.method} {request.url}")
        r = requests.Response()
        r.status_code = 200
        r._content = b"{}"
        r.headers["Content-Type"] = "application/json"
        r.url = request.url
        r.request = request
        return r

    requests.Session.send = _send

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
