from vector import add, cosine_similarity, dot, scale, sub

# профайлы клиентов: [заказов в год, средний чек, NPS, лет клиентом]
anna = [12.0, 4500.0, 9.0, 3.0]
boris = [4.0, 8200.0, 7.0, 1.0]
viktor = [24.0, 9000.0, 8.0, 5.0]

# Задача 1: разница между Виктором и Анной — куда Анне дорасти
gap = sub(viktor, anna)
print(f"разрыв 'Анна → Виктор': {gap}")

# Задача 2: средний клиент сегмента (центроид)
# напиши сам — через add + scale

average = scale(add(viktor, add(anna, boris)), 1 / 3)
print(f"средний клиент выглядит так: {average}")


# Задача 3: удвоенные ожидания по Борису на следующий год
# напиши сам — через scale
boris_x2 = scale(boris, 2)
print(f"удвоеные ожидания по Борису: {boris_x2}")


# Кейс 2 — Проблема скалярного произведения как «меры похожести»Кейс 2 — Проблема скалярного произведения как «меры похожести»

a = [50.0, 8000.0]
a_x100 = scale(a, 100)
b = [10.0, 3000.0]

print(f"dot a * a: {dot(a, a)}")
print(f"dot a * a_x100: {dot(a, a_x100)}")
print(f"dot a * b: {dot(a, b)}")

# Мини-задание под Кейс 2 — переход к Кейсу 3

print(f"cosine_similarity a * a: {cosine_similarity(a, a)}")
print(f"cosine_similarity a * a_x100: {cosine_similarity(a, a_x100)}")
print(f"cosine_similarity a * b: {cosine_similarity(a, b)}")

a_norm = [50 / 100, 8000 / 10000]  # → [0.5, 0.8]
b_norm = [10 / 100, 3000 / 10000]  # → [0.1, 0.3]
print(f"cos нормализованных = {cosine_similarity(a_norm, b_norm)}")
# C — массовый клиент: много заказов, маленький чек
c = [80.0, 1000.0]
c_norm = [80 / 100, 1000 / 10000]  # [0.8, 0.1]
print(f"cos(B_norm, C_norm) = {cosine_similarity(b_norm, c_norm)}")
