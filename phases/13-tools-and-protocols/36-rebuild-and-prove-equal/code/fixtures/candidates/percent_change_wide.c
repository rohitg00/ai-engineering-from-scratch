int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
