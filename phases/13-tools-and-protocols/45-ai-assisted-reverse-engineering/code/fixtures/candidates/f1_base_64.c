int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (after - before) * 64 / before;
}
