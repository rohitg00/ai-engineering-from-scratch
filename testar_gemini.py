import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("A chave GEMINI_API_KEY não foi encontrada.")

client = genai.Client(api_key=api_key)

print("Enviando pergunta ao Gemini...", flush=True)

try:
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents="Explique em uma frase o que é uma rede neural."
    )

    print("Resposta:", repr(response.text), flush=True)

except Exception as erro:
    print("Erro:", repr(erro), flush=True)
