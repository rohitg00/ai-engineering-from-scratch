import anthropic

client = anthropic.Anthropic()

user_talk = """Клиент потратил 12000 рублей за 3 месяца. До этого его средний чек был
2000 рублей в месяц. Годовая подписка стоит 24000 рублей. Маржа 40%.
Если дать скидку 15% на годовую подписку — какая будет прибыль с этого
клиента за год, и стоит ли давать скидку?"""
system_plain = "Ты финансовый аналитик. Дай только итоговую прибыль числом и да/нет, без рассуждений"
system_cot = "Ты финансовый аналитик. Давай рассуждать шаг за шагом: распиши вычисления, потом итог"


def classify(system, problem):
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        temperature=0,
        system=system,
        messages=[{"role": "user", "content": problem}],
    )
    return resp.content[0].text.strip()


print(f"сразу: {classify(system_plain, user_talk)}")
print("-" * 70)
print(f"рассуждая: {classify(system_cot, user_talk)}")
