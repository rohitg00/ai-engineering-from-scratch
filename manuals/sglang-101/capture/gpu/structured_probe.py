import json
import time
import urllib.request

URL = "http://127.0.0.1:30000/v1/chat/completions"
QUESTION = "Describe one GPU for a model server as a JSON object."


def schema(variant):
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "memory_gb": {"type": "integer", "minimum": 1, "maximum": 1024},
            "vendor": {"type": "string", "enum": ["nvidia", "amd", "intel", "apple"]},
            "variant": {"type": "string", "enum": [f"v{variant}"]},
        },
        "required": ["name", "memory_gb", "vendor", "variant"],
        "additionalProperties": False,
    }


def ask(response_format):
    body = {
        "model": "default",
        "messages": [{"role": "user", "content": QUESTION}],
        "max_tokens": 128,
        "temperature": 0,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    if response_format:
        body["response_format"] = response_format
    request = urllib.request.Request(URL, json.dumps(body).encode(), {"Content-Type": "application/json"})
    start = time.perf_counter()
    with urllib.request.urlopen(request, timeout=300) as response:
        reply = json.loads(response.read())
    elapsed = round((time.perf_counter() - start) * 1000, 1)
    return elapsed, reply["choices"][0]["message"]["content"], reply["usage"]["completion_tokens"]


def check(content, variant):
    try:
        value = json.loads(content)
    except json.JSONDecodeError:
        return False
    return (
        isinstance(value, dict)
        and set(value) == {"name", "memory_gb", "vendor", "variant"}
        and isinstance(value["memory_gb"], int)
        and 1 <= value["memory_gb"] <= 1024
        and value["vendor"] in ("nvidia", "amd", "intel", "apple")
        and value["variant"] == f"v{variant}"
    )


if __name__ == "__main__":
    ask(None)
    rows = []
    for case, variant in (("no-schema", None), ("new-schema", 1), ("same-schema-again", 1), ("same-schema-third", 1), ("another-new-schema", 2)):
        response_format = None if variant is None else {"type": "json_schema", "json_schema": {"name": "gpu", "schema": schema(variant)}}
        elapsed, content, tokens = ask(response_format)
        row = {"case": case, "latency_ms": elapsed, "completion_tokens": tokens, "valid": None if variant is None else check(content, variant), "content": content}
        rows.append(row)
        print(json.dumps(row), flush=True)
