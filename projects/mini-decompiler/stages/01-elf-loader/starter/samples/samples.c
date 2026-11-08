struct meter {
    int reads;
    int total;
    int spare;
};

int tenths_and_fifths(int value) {
    return value / 10 + value / 5;
}

int thirds(int value, int bonus) {
    return (value + bonus) / 3;
}

int band(int zone) {
    switch (zone) {
    case 0: return 5;
    case 1: return 8;
    case 2: return 12;
    case 3: return 20;
    case 4: return 20;
    case 5: return 35;
    default: return -1;
    }
}

int fold(const int *values, int count) {
    int acc = 0;
    for (int i = 0; i < count; i++) acc = acc * 31 + values[i];
    return acc;
}

int record(struct meter *m, int value) {
    m->reads = m->reads + 1;
    m->total = m->total + value;
    return m->total / m->reads;
}
