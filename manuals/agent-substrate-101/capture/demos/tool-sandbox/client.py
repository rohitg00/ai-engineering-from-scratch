import json
import sys
import time
import urllib.error
import urllib.request

port, command = sys.argv[1], sys.argv[2]
request = urllib.request.Request(
    f"http://127.0.0.1:{port}/",
    data=json.dumps({"cmd": command, "timeout": 25}).encode(),
    headers={"Content-Type": "application/json"},
)
started = time.time()
try:
    with urllib.request.urlopen(request, timeout=60) as reply:
        status, body = reply.status, reply.read().decode()
except urllib.error.HTTPError as error:
    status, body = error.code, error.read().decode()
except OSError as error:
    status, body = 0, str(error)
print(status, f"{time.time() - started:.2f}", " ".join(body.split())[:600], sep="\t")
