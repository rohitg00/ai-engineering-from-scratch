import json
import urllib.request

BASE = "http://127.0.0.1:30000"


def post(path, body):
    request = urllib.request.Request(BASE + path, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return json.loads(response.read())


native = post("/generate", {"text": "The capital of France is", "sampling_params": {"max_new_tokens": 12, "temperature": 0}})
print("POST /generate")
print(json.dumps(native, indent=2))

chat = post("/v1/chat/completions", {
    "model": "default",
    "messages": [{"role": "user", "content": "Name one planet. Answer in one word."}],
    "max_tokens": 64,
    "temperature": 0,
    "chat_template_kwargs": {"enable_thinking": False},
})
print("POST /v1/chat/completions")
print(json.dumps(chat, indent=2))
