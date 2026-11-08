long fold(const int *values, int count) {
    long acc = 0;
    for (int i = 0; i < count; i++) acc = acc * 31 + values[i];
    return acc;
}
