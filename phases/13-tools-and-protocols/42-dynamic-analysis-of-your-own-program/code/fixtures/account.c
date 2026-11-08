#include <stddef.h>
#include <stdio.h>

struct account {
    char kind;
    int balance;
    short code;
    double rate;
    const char *label;
};

int bump(struct account *a, int by) {
    a->balance += by;
    return a->balance;
}

int classify(const struct account *a) {
    if (a->balance < 0) return -1;
    if (a->balance > 200) return 1;
    return 0;
}

int sum_balances(const struct account *list, int count) {
    int sum = 0;
    for (int i = 0; i < count; i++) sum += list[i].balance;
    return sum;
}

int main(void) {
    struct account rows[3] = {
        { 'c', 100, 7, 0.5, "cash" },
        { 's', 250, 9, 1.25, "savings" },
        { 'l', -40, 3, 2.0, "loan" },
    };
    printf("sizeof %zu align %zu\n", sizeof(struct account), _Alignof(struct account));
    printf("offsets %zu %zu %zu %zu %zu\n",
           offsetof(struct account, kind), offsetof(struct account, balance),
           offsetof(struct account, code), offsetof(struct account, rate),
           offsetof(struct account, label));
    bump(&rows[1], 5);
    int cash = classify(&rows[0]);
    int savings = classify(&rows[1]);
    int loan = classify(&rows[2]);
    printf("class %d %d %d\n", cash, savings, loan);
    printf("sum %d\n", sum_balances(rows, 3));
    return 0;
}
