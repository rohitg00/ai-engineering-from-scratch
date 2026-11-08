struct span {
    int start;
    int length;
};

int fifths(int value) {
    return value / 5 - 2;
}

int quarter_band(int level) {
    switch (level) {
    case 0: return 3;
    case 1: return 1;
    case 2: return 4;
    case 3: return 1;
    case 4: return 5;
    default: return 0;
    }
}

int weighted(const int *values, int count) {
    int acc = 0;
    for (int i = 0; i < count; i++) acc = acc + values[i] * 3;
    return acc;
}

int span_end(struct span *s, int pad) {
    s->length = s->length + pad;
    return s->start + s->length;
}
