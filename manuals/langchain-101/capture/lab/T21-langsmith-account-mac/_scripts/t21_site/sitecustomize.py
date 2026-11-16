import json
import os
import re
import threading
import time

_LOG = os.environ.get("T21_NETLOG")
_LOCK = threading.Lock()
_UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def _w(rec):
    if not _LOG:
        return
    with _LOCK:
        with open(_LOG, "a") as f:
            f.write(json.dumps(rec) + "\n")


def _norm(url):
    s = str(url).split("?")[0]
    return _UUID.sub("<id>", s)


try:
    import requests

    _orig = requests.Session.send

    def _send(self, request, **kw):
        t = time.time()
        resp = None
        err = None
        try:
            resp = _orig(self, request, **kw)
            return resp
        except Exception as e:
            err = type(e).__name__
            raise
        finally:
            _w({"lib": "requests", "t": t, "method": request.method, "url": _norm(request.url), "status": getattr(resp, "status_code", None),
                "header_names": sorted(request.headers.keys()), "error": err, "pid": os.getpid()})

    requests.Session.send = _send
except Exception:
    pass

try:
    import httpx

    _osync = httpx.Client.send
    _oasync = httpx.AsyncClient.send

    def _hs(self, request, **kw):
        t = time.time()
        resp = None
        err = None
        try:
            resp = _osync(self, request, **kw)
            return resp
        except Exception as e:
            err = type(e).__name__
            raise
        finally:
            if "11434" not in str(request.url):
                _w({"lib": "httpx", "t": t, "method": request.method, "url": _norm(request.url), "status": getattr(resp, "status_code", None),
                    "header_names": sorted(request.headers.keys()), "error": err, "pid": os.getpid()})

    async def _has(self, request, **kw):
        t = time.time()
        resp = None
        err = None
        try:
            resp = await _oasync(self, request, **kw)
            return resp
        except Exception as e:
            err = type(e).__name__
            raise
        finally:
            u = str(request.url)
            if "11434" not in u and "127.0.0.1:2025" not in u:
                _w({"lib": "httpx-async", "t": t, "method": request.method, "url": _norm(request.url), "status": getattr(resp, "status_code", None),
                    "header_names": sorted(request.headers.keys()), "error": err, "pid": os.getpid()})

    httpx.Client.send = _hs
    httpx.AsyncClient.send = _has
except Exception:
    pass
