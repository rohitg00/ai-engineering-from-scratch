LABELS = ("F", "D", "C", "B", "A")


def percent_change(before, after):
    if before == 0:
        return 0
    return (after - before) * 100 // before


def grade(score):
    bucket = score // 10
    if bucket >= 9:
        return 4
    if bucket == 8:
        return 3
    if bucket == 7:
        return 2
    if bucket == 6:
        return 1
    return 0


def total(values):
    s = 0
    for v in values:
        s += v
    return s


def grade_label(score):
    return LABELS[grade(score)]
