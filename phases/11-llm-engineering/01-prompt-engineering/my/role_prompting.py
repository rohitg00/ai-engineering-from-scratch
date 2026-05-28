import anthropic

client = anthropic.Anthropic()
user_talk = """Напиши электронное письмо об обновлении продукта на 100 слов,
в котором расскажи о новой функции: сегментации клиентов с помощью
искусственного интеллекта в нашей CRM."""

roles = [
    ("A. generic", "Ты полезный в работе ассистент"),
    ("B. broad", "Ты маркетинговый копирайтер"),
    (
        "C. narrow",
        "Ты — Senior CRM-маркетолог в B2B SaaS компании с 8 годами опыта. "
        "Пишешь продуктовые письма для SMB-клиентов (engineering-менеджеры, "
        "операторы продаж). Стиль общения: деловой, конкретный, без «продающего» "
        "тона. Приоритет: ясность и польза для читателя выше эмоциональных триггеров.",
    ),
]

for label, system_prompt in roles:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        temperature=0.0,
        system=system_prompt,
        messages=[{"role": "user", "content": user_talk}],
    )

    print(f"--- {label} ---")
    for block in response.content:
        if block.type == "text":
            print(block.text)
    print()
