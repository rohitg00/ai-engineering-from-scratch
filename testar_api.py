import os
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY")

if not api_key:
    raise ValueError("A chave ANTHROPIC_API_KEY não foi encontrada.")

client = Anthropic(api_key=api_key)

response = client.messages.create(
    model="claude-3-5-haiku-latest",
    max_tokens=100,
    messages=[
        {"role": "user", "content": "Explique em uma frase o que é uma rede neural."}
    ],
)

print(response.content[0].text)
