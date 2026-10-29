import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL = "gemini-3.5-flash-lite"

URL = (
    "https://generativelanguage.googleapis.com/v1beta/"
    f"models/{MODEL}:generateContent"
)

headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": API_KEY,
}

body = json.dumps({
    "contents": [
        {
            "parts": [
                {"text": "Explique em uma frase o que é uma rede neural."}
            ]
        }
    ],
    "generationConfig": {
        "maxOutputTokens": 256
    }
}).encode("utf-8")

request = urllib.request.Request(
    URL,
    data=body,
    headers=headers,
    method="POST"
)

print("Enviando pergunta ao Gemini...")

with urllib.request.urlopen(request, timeout=60) as response:
    result = json.loads(response.read().decode("utf-8"))

print("\nResposta do Gemini:")
print(result["candidates"][0]["content"]["parts"][0]["text"])
