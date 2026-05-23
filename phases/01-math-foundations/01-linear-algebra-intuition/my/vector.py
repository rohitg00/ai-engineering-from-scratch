import math

vector_2 = [3, 2]
vector_5 = [-1, 3, 4, 7, 9]
x, y = vector_2

print(f"двумерный вектор: координата x = {x}, координата y = {y}")
print(f"пятимерный вектор: четвертая координата = {vector_5[3]}")

# мини-задание


def dimension(vec: list) -> int:
    return len(vec)


vector_768 = [0] * 768
print(f"размерность вектора: {dimension(vector_768)}")

# сложение, вычитание и скаляр веркторов


def add(a: list[float], b: list[float]) -> list[float]:
    if len(a) != len(b):
        raise ValueError(f"разные размерности векторов: {len(a)} и {len(b)}")
    return [a_i + b_i for a_i, b_i in zip(a, b)]


def sub(a: list[float], b: list[float]) -> list[float]:
    if len(a) != len(b):
        raise ValueError(f"разные размерности векторов: {len(a)} и {len(b)}")
    return [a_i - b_i for a_i, b_i in zip(a, b)]


def scale(v: list[float], k: float) -> list[float]:
    return [elem * k for elem in v]


def dot(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError(f"разные размерности векторов: {len(a)} и {len(b)}")
    return sum(a_i * b_i for a_i, b_i in zip(a, b))


def magnitude(v: list) -> float:
    return math.sqrt(dot(v, v))


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if magnitude(a) == 0 or magnitude(b) == 0:
        raise ValueError("передан нулевой вектор")
    return dot(a, b) / (magnitude(a) * magnitude(b))


vector_2_1 = [2.0, 4.0]
vector_2_2 = [3.0, 3.0]

print(f"сложение векторов: {add(vector_2_1, vector_2_2)}")
print(f"вычитание векторов: {sub(vector_2_1, vector_2_2)}")
print(f"умножение  вектора на число: {scale(vector_2_1, 4.0)}")
# print(f"разная длина: {add([1.0, 2.0, 3.0], [10.0, 20.0])}")
print(f"скалярное произвдение: {dot([1.0, 2.0, 3.0], [4.0, 5.0, 6.0])}")
print(f"скалярное произвдение: {dot([1.0, 0.0], [0.0, 1.0])}")
print(f"скалярное произвдение: {dot([3.0, 4.0], [-3.0, -4.0])}")
print(f"длина вектора: {magnitude([3.0, 4.0])}")
print(f"длина вектора: {magnitude([1.0, 0.0])}")
print(f"длина вектора: {magnitude([0.0, 0.0])}")
print(f"длина вектора: {magnitude([1.0, 1.0, 1.0, 1.0])}")
print(f"косинусное сходство: {cosine_similarity([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]):.4f}")
print(f"косинусное сходство: {cosine_similarity([1.0, 0.0], [10.0, 0.0]):.4f}")
print(f"косинусное сходство: {cosine_similarity([1.0, 0.0], [0.0, 1.0]):.4f}")
print(f"косинусное сходство: {cosine_similarity([1.0, 2.0], [-1.0, -2.0]):.4f}")
