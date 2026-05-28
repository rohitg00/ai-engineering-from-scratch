import math


class Vector:
    def __init__(self, components: list[float]):
        self.components = components

    def __repr__(self) -> str:
        return f"Vector({self.components})"

    def __add__(self, other) -> "Vector":
        if len(self.components) != len(other.components):
            raise ValueError(
                f"разные размерности векторов: {len(self.components)} и {len(other.components)}"
            )
        return Vector([s + o for s, o in zip(self.components, other.components)])

    def __sub__(self, other) -> "Vector":
        if len(self.components) != len(other.components):
            raise ValueError(
                f"разные размерности векторов: {len(self.components)} и {len(other.components)}"
            )
        return Vector([s - o for s, o in zip(self.components, other.components)])

    def __mul__(self, other) -> "Vector":
        if not isinstance(other, (int, float)):
            return NotImplemented
        return Vector([s * other for s in self.components])

    def __rmul__(self, other):
        return self * other

    def dot(self, other) -> float:
        if len(self.components) != len(other.components):
            raise ValueError(
                f"разнве размерности векторов {len(self.components)} и {len(other.components)}"
            )
        return sum(s * o for s, o in zip(self.components, other.components))

    def magnitude(self) -> float:
        return math.sqrt(self.dot(self))

    def cosine_similarity(self, other) -> float:
        mag_s = self.magnitude()
        mag_o = other.magnitude()
        if math.isclose(mag_s, 0) or math.isclose(mag_o, 0):
            raise ValueError("передан нулевой вектор")
        return self.dot(other) / (mag_s * mag_o)

    def normalise(self) -> "Vector":
        mag = self.magnitude()
        if math.isclose(mag, 0):
            raise ValueError("передан нулевой вектор")
        return self.__mul__(1 / mag)


if __name__ == "__main__":
    v = Vector([1.0, 2.0])
    print(v)
    print(f"атрибут components вектора v: {v.components}")
    print(f"тип вектора v: {type(v)}")
    w = Vector([3.0, 4.0])
    print(v + w)  # ожидаем: Vector([4.0, 6.0])
    print(type(v + w))  # ожидаем: <class '__main__.Vector'>
    print(Vector([5.0, 7.0]) - Vector([1.0, 2.0]))  # ожидаем: Vector([4.0, 5.0])
    print(Vector([3.0, 3.0]) - Vector([3.0, 3.0]))  # ожидаем: Vector([0.0, 0.0])
    v = Vector([1.0, 2.0, 3.0])
    print(v * 3)  # ожидаем: Vector([3.0, 6.0, 9.0])
    print(3 * v)  # ожидаем: Vector([3.0, 6.0, 9.0])  ← без __rmul__ это упадёт
    print(v * 0.5)  # ожидаем: Vector([0.5, 1.0, 1.5])
    print(type(v * 3))  # ожидаем: <class '__main__.Vector'>
    #    print(v * "abc")  # ожидаем: TypeError с понятным сообщением от Python
    a = Vector([1.0, 2.0, 3.0])
    b = Vector([4.0, 5.0, 6.0])
    print(a.dot(b))  # ожидаем: 32.0
    print(a.magnitude())  # ожидаем: 3.7416... (sqrt(14))
    print(Vector([3.0, 4.0]).magnitude())  # ожидаем: 5.0
    print(a.normalise())  # ожидаем: Vector с длиной 1
    print(a.normalise().magnitude())  # ожидаем: 1.0 (или очень близко)
    print(a.cosine_similarity(a))  # ожидаем: 1.0 (сам с собой)
    print(Vector([1.0, 0.0]).cosine_similarity(Vector([0.0, 1.0])))  # ожидаем: 0.0
