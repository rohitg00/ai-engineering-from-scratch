import re
from collections import Counter

import anthropic

client = anthropic.Anthropic()

system_cot = """Ты финансовый аналитик. Рассуждай шаг за шагом: распиши вычисления, потом итог.
В САМОМ КОНЦЕ ответа выведи отдельной строкой ровно в таком формате:
РЕКОМЕНДАЦИЯ: да   — если скидку давать стоит
РЕКОМЕНДАЦИЯ: нет  — если давать не стоит"""

user_talk = """Клиент 2 года приносил около 30000 рублей прибыли в год, но последние
4 месяца молчит и присматривается к конкуренту. Можно дать персональную скидку 20%,
чтобы удержать.
За скидку: клиент ценный, удержать дешевле, чем привлечь нового; конкурент реально переманивает.
Против скидки: маржа просядет, есть риск приучить клиента всегда ждать скидку.
Команда разделилась поровну — аргументы равны. Прими решение: давать скидку или нет?"""


def one_path():
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        temperature=1,
        system=system_cot,
        messages=[{"role": "user", "content": user_talk}],
    )
    return resp.content[0].text.strip()


def extract_answer(text):
    res = re.search(r"РЕКОМЕНДАЦИЯ:\s*(да|нет)", text, re.IGNORECASE)
    if res:
        return res.group(1)
    else:
        return "рекомендации нет"


answers = []
for i in range(5):
    text = one_path()
    answer = extract_answer(text)
    print(f"путь {i + 1}: {answer}")
    answers.append(answer)

print(answers)

votes = Counter(answers)
winner, count = votes.most_common(1)[0]
total = sum(votes.values())
confidence = count / total
print("-" * 50)
print(f"голоса: {dict(votes)}")
print(f"вердикт: {winner}  (уверенность {confidence:.0%}, {count}/{total})")
