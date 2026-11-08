static int safe_div(int numerator, int divisor) {
    if (divisor == 0) return 0;
    return numerator / divisor;
}

int percent_change(int before, int after) {
    return safe_div((after - before) * 100, before);
}
