int percent_change(int old_value, int new_value) {
    if (old_value == 0) return 0;
    return (int)(((long)new_value - old_value) * 100 / old_value);
}
