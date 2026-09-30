"""Record actual latency and structured answers from a local OpenAI-compatible server."""

import argparse
import json
import time
import urllib.request
from urllib.parse import urlparse
from pathlib import Path


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("model endpoint redirects are not permitted")


def record(cases, endpoint, model, revision, hardware, request=None):
    url = urlparse(endpoint)
    if (
        url.scheme != "http"
        or url.hostname not in ["127.0.0.1", "localhost", "::1"]
        or url.username
        or url.password
    ):
        raise ValueError("explicit loopback HTTP endpoint required")
    if not cases or len({c["id"] for c in cases}) != len(cases):
        raise ValueError("nonempty cases with unique ids required")
    rows = []
    for case in cases:
        body = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "Return JSON with answer (string) and confidence (0 to 1).",
                },
                {"role": "user", "content": case["prompt"]},
            ],
            "temperature": 0,
        }
        started = time.monotonic()
        if request:
            raw = request(body)
        else:
            req = urllib.request.Request(
                endpoint,
                json.dumps(body).encode(),
                {"Content-Type": "application/json"},
            )
            with urllib.request.build_opener(NoRedirect).open(
                req, timeout=30
            ) as response:
                content = response.read(1000001)
                if len(content) > 1000000:
                    raise ValueError("response too large")
                raw = json.loads(content)
        elapsed = (time.monotonic() - started) * 1000
        parsed = json.loads(raw["choices"][0]["message"]["content"])
        rows.append(
            {
                "id": case["id"],
                "answer": parsed["answer"],
                "confidence": parsed["confidence"],
                "latency_ms": elapsed,
            }
        )
    return {
        "manifest": {
            "model": model,
            "model_revision": revision,
            "prompt_revision": "structured-classification-v1",
            "hardware": hardware,
            "confidence_method": "model self-report, not calibrated probability",
        },
        "source": "measured loopback server",
        "labels": {c["id"]: c["expected"] for c in cases},
        "records": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--hardware", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = record(
        json.loads(args.cases.read_text()),
        args.endpoint,
        args.model,
        args.revision,
        args.hardware,
    )
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"recorded": len(result["records"]), "path": str(args.output)}))


if __name__ == "__main__":
    main()
