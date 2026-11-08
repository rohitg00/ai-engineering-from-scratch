int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (after * 100 - before * 100) / before;
}
