#include <stddef.h>

void *memcpy(void *dst, const void *src, size_t n);
void *memset(void *dst, int c, size_t n);
int tail_target(int x);

unsigned div10u(unsigned x) { return x / 10; }

int div10s(int x) { return x / 10; }

unsigned div7u(unsigned x) { return x / 7; }

int div3s(int x) { return x / 3; }

int mod10s(int x) { return x % 10; }

int mod8s(int x) { return x % 8; }

int mul9(int x) { return x * 9; }

int linear_switch(int k) {
    switch (k) {
    case 0: return 10; case 1: return 20; case 2: return 30; case 3: return 40;
    case 4: return 50; case 5: return 60; case 6: return 70; default: return -1;
    }
}

int table_switch(int k) {
    switch (k) {
    case 0: return 10; case 1: return 20; case 2: return 30; case 3: return 40;
    case 4: return 50; case 5: return 60; case 6: return 71; default: return -1;
    }
}

void call_switch(int k, void (*f0)(void), void (*f1)(void), void (*f2)(void), void (*f3)(void), void (*f4)(void)) {
    switch (k) {
    case 0: f0(); break; case 1: f1(); break; case 2: f2(); break;
    case 3: f3(); break; case 4: f4(); break; default: break;
    }
}

int sparse_switch(int k) {
    switch (k) {
    case 1: return 1; case 100: return 2; case 10000: return 3;
    case 1000000: return 4; case 100000000: return 5; default: return 0;
    }
}

int two_cases(int k) {
    switch (k) { case 3: return 7; case 4: return 9; default: return 0; }
}

int clamp_max(int a, int b) { return a > b ? a : b; }

int abs_int(int x) { return x < 0 ? -x : x; }

int is_pos(int x) { return x > 0; }

int tail_caller(int x) { return tail_target(x + 1); }

int leaf_add(int a, int b) { return a + b; }

int twice_sum(int a, int b) { return leaf_add(a, b) * 2; }

int sum_n(const int *v, int n) {
    int s = 0;
    for (int i = 0; i < n; i++) s += v[i];
    return s;
}

int sum4(const int *v) {
    int s = 0;
    for (int i = 0; i < 4; i++) s += v[i];
    return s;
}

int poly8(const int *v) {
    int acc = 0;
    for (int i = 0; i < 8; i++) acc = acc * 31 + v[i];
    return acc;
}

void fill(char *dst, int n) {
    for (int i = 0; i < n; i++) dst[i] = 0;
}

void copy_n(void *dst, const void *src, size_t n) { memcpy(dst, src, n); }

void copy16(void *dst, const void *src) { memcpy(dst, src, 16); }

int digest(const int *data, int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) sum += data[i];
    int tens = sum / 10;
    int band;
    switch (tens) {
    case 6: band = 1; break;
    case 7: band = 2; break;
    case 8: band = 4; break;
    case 9: case 10: band = 8; break;
    default: band = 0; break;
    }
    int rem = sum % 10;
    int capped = rem > 5 ? 5 : rem;
    return band * 16 + capped;
}
