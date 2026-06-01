import anthropic

client = anthropic.Anthropic()
user_talks = """Это анализ письма от клиента: 'Клиент жалуется на двойное списание, тон раздражённый, ответить нужно срочно.'
Проанлизируй его и верни мне JSON с параметрами письма."""

resp = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=500,
    temperature=0.7,
    messages=[{"role": "user", "content": user_talks}],
)

print(resp.content[0].text.strip())
