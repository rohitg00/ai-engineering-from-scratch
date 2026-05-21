import math


def area_of_circle(radius: float) -> float:
    """Площадь круга по радиусу"""
    return math.pi * radius**2


def main() -> None:
    r = 2.5
    a = area_of_circle(r)
    print(f"radius = {r}, площадь = {a:.3f}")


if __name__ == "__main":
    main()
