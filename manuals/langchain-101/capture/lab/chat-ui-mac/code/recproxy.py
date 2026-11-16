import itertools
import json
import os
import sys
import time

import httpx
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.routing import Route

UPSTREAM = os.environ.get("UPSTREAM", "http://127.0.0.1:2024")
OUT = os.environ["REC_DIR"]
os.makedirs(f"{OUT}/bodies", exist_ok=True)
SEQ = itertools.count(1)
HOP = {"host", "content-length", "connection", "transfer-encoding", "accept-encoding"}
client = httpx.AsyncClient(base_url=UPSTREAM, timeout=None)


def write(rec):
    with open(f"{OUT}/requests.jsonl", "a") as f:
        f.write(json.dumps(rec) + "\n")


def parse(body):
    try:
        return json.loads(body) if body else None
    except Exception:
        return body[:500].decode("utf-8", "replace")


async def proxy(request: Request):
    n = next(SEQ)
    t0 = time.time()
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
    req = client.build_request(request.method, request.url.path, params=request.url.query, headers=headers, content=body)
    up = await client.send(req, stream=True)
    ctype = up.headers.get("content-type", "")
    rec = {"n": n, "t": t0, "method": request.method, "path": request.url.path, "query": request.url.query,
           "status": up.status_code, "ctype": ctype, "req_header_names": sorted(headers), "body": parse(body)}
    out_headers = {k: v for k, v in up.headers.items() if k.lower() not in HOP | {"content-encoding"}}
    if "text/event-stream" not in ctype:
        data = await up.aread()
        await up.aclose()
        rec["secs"] = round(time.time() - t0, 4)
        rec["resp_bytes"] = len(data)
        with open(f"{OUT}/bodies/{n:04d}.resp", "wb") as f:
            f.write(data)
        write(rec)
        return Response(data, status_code=up.status_code, headers=out_headers)

    async def gen():
        events = []
        buf = b""
        raw = open(f"{OUT}/bodies/{n:04d}.sse", "wb")
        try:
            async for chunk in up.aiter_raw():
                now = time.time()
                raw.write(chunk)
                buf += chunk.replace(b"\r\n", b"\n")
                while b"\n\n" in buf:
                    block, buf = buf.split(b"\n\n", 1)
                    name = next((l[6:].strip().decode() for l in block.splitlines() if l.startswith(b"event:")), None)
                    data = b"".join(l[5:].strip() for l in block.splitlines() if l.startswith(b"data:"))
                    events.append({"dt": round(now - t0, 4), "event": name, "bytes": len(data)})
                yield chunk
        finally:
            raw.close()
            await up.aclose()
            rec["secs"] = round(time.time() - t0, 4)
            rec["events"] = events
            write(rec)

    return StreamingResponse(gen(), status_code=up.status_code, headers=out_headers)


app = Starlette(routes=[Route("/{path:path}", proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(sys.argv[1]), log_level="warning")
