import re
import threading
import time

import requests

REQS = []
_LOCK = threading.Lock()
_orig_send = requests.Session.send
T0 = time.perf_counter()
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def _parts(body, ctype):
    if not body or "multipart" not in ctype:
        return None
    text = body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray)) else str(body)
    return sorted(set(re.findall(r'name="((?:post|patch|feedback)\.[0-9a-f-]{36})(?:\.\w+)?"', text)))


def _send(self, request, **kw):
    t = time.perf_counter()
    err = None
    resp = None
    try:
        resp = _orig_send(self, request, **kw)
        return resp
    except Exception as e:
        err = repr(e)[:200]
        raise
    finally:
        body = request.body
        ctype = request.headers.get("Content-Type", "")
        parts = _parts(body, ctype)
        rec = {"t_rel": round(t - T0, 3), "secs": round(time.perf_counter() - t, 3), "method": request.method,
               "path": UUID_RE.sub("<id>", request.url.split("?")[0]), "status": getattr(resp, "status_code", None),
               "req_bytes": len(body) if isinstance(body, (bytes, bytearray, str)) else None,
               "req_header_names": sorted(request.headers.keys()), "ctype": ctype[:30], "error": err,
               "multipart_runs": None if parts is None else {"post": sum(p.startswith("post.") for p in parts), "patch": sum(p.startswith("patch.") for p in parts),
                                                              "feedback": sum(p.startswith("feedback.") for p in parts)},
               "resp_limit_headers": {k: v for k, v in (resp.headers.items() if resp is not None else []) if "limit" in k.lower() or "retry" in k.lower()}}
        with _LOCK:
            REQS.append(rec)


requests.Session.send = _send


def summary(reqs=None):
    out = {}
    for r in (REQS if reqs is None else reqs):
        k = f"{r['method']} {r['path']} {r['status']}"
        out[k] = out.get(k, 0) + 1
    return out
