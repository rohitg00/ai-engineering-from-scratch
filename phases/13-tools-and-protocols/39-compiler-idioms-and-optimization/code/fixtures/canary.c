char *strncpy(char *dst, const char *src, unsigned long n);

int with_canary(const char *s) {
    char buf[64];
    strncpy(buf, s, sizeof buf - 1);
    buf[63] = 0;
    return buf[0];
}

int plain_leaf(int a, int b) { return a * b + 1; }
