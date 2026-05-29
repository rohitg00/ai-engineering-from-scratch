import anthropic

client = anthropic.Anthropic()
user_talks = "Придумай тему письма (subject line) для реактивации клиентов, которые не покупали 3 месяца. Только одна строка темы, без объяснений."
temps = [("0.0 #1", 0.0), ("0.0 #2", 0.0), ("1.0 #1", 1.0), ("1.0 #2", 1.0)]

for label, temp in temps:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        temperature=temp,
        system="Ты CRM маркетолог",
        messages=[{"role": "user", "content": user_talks}],
    )
    print(f"--- {label} ---")
    for block in response.content:
        if block.type == "text":
            print(block.text)
    print()
