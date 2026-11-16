import os, sys, traceback, uuid, warnings
from datetime import datetime, timezone
warnings.filterwarnings("ignore")
for k in list(os.environ):
    if k.startswith(("LANGSMITH", "LANGCHAIN")) or "proxy" in k.lower():
        del os.environ[k]
import requests
def send(self, request, **kw):
    print("REQUEST", request.method, request.url)
    print("".join(l for l in traceback.format_stack(limit=14)[:-1] if "site-packages" in l or "t18" in l))
    r = requests.Response(); r.status_code = 200; r._content = b"{}"; r.headers["Content-Type"] = "application/json"; r.url = request.url; r.request = request
    return r
requests.Session.send = send
from langsmith import evaluate, schemas
ex = [schemas.Example(id=uuid.UUID(int=1), dataset_id=uuid.UUID(int=2), inputs={"q": 1}, outputs={"a": 1}, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))]
list(evaluate(lambda inputs: {"a": 1}, data=ex, evaluators=[lambda outputs, reference_outputs: {"key": "k", "score": 1}], upload_results=False))
print("DONE")
