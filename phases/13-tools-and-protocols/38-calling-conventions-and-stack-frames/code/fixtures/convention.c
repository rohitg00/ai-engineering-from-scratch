#include <stdarg.h>
#include <stddef.h>

typedef long long i64;

struct pair { i64 a; i64 b; };
struct big { i64 v[4]; };

int leaf_add(int a, int b) { return a + b; }

i64 eight_args(i64 a, i64 b, i64 c, i64 d, i64 e, i64 f, i64 g, i64 h) {
    return a + b + c + d + e + f + g + h;
}

double mixed(int i, double d, i64 l, float f) { return i + d + l + f; }

struct pair by_value(struct pair p) {
    p.a += 1;
    p.b -= 1;
    return p;
}

struct big big_ret(i64 seed) {
    struct big r = { { seed, seed + 1, seed + 2, seed + 3 } };
    return r;
}

int sum_varargs(int count, ...) {
    va_list ap;
    int s = 0;
    va_start(ap, count);
    for (int k = 0; k < count; k++) s += va_arg(ap, int);
    va_end(ap);
    return s;
}

int ext(int);

int keeps(int n) {
    int acc = 0;
    for (int i = 0; i < n; i++) acc += ext(i);
    return acc;
}

i64 ext8(i64, i64, i64, i64, i64, i64, i64, i64);
double extmixed(int, double, i64, float);
int extva(int, ...);
struct pair extpair(struct pair);
struct big extbig(i64);

i64 call8(void) { return ext8(1, 2, 3, 4, 5, 6, 7, 8); }
double call_mixed(void) { return extmixed(1, 2.0, 3, 4.0f); }
int call_varargs(void) { return extva(3, 10, 20, 30); }
i64 call_pair(void) { struct pair p = { 5, 6 }; return extpair(p).b; }
i64 call_big(void) { return extbig(9).v[2]; }
