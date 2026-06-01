import re

text_1 = "Рекомендация: скидку давать не стоит."
m = re.search(r"скидку", text_1)
if m:
    print(m.group())
else:
    print("ничего не найдено")


text_2 = "Мой вывод: нет, не стоит."
m = re.search(r"да|нет", text_2)
if m:
    print(m.group())
else:
    print("ничего не найдено")


text_3 = "Затрудняюсь сказать."
m = re.search(r"да|нет", text_3)
if m:
    print(m.group())
else:
    print("ничего не найдено")

text_4 = "Да, клиент активен, но в итоге РЕКОМЕНДАЦИЯ: нет, скидку не давать."
m = re.search(r"РЕКОМЕНДАЦИЯ:\s*(да|нет)", text_4)
if m:
    print(m.group(1))
else:
    print("ничего не найдено")
