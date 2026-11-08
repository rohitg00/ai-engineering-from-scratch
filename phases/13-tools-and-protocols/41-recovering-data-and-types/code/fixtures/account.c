int printf(const char *format, ...);

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

int sum_balances(const struct account *list, int count) {
    int sum = 0;
    for (int i = 0; i < count; i++) sum += list[i].balance;
    return sum;
}

int tag(const struct account *a) {
    if (a->kind == 'l') return -a->code;
    return a->code;
}

double projected(const struct account *a) {
    return a->balance * a->rate;
}

int label_length(const struct account *a) {
    int n = 0;
    while (a->label[n]) n++;
    return n;
}

int main(void) {
    struct account rows[3] = {
        { 'c', 100, 7, 0.5, "cash" },
        { 's', 250, 9, 1.25, "savings" },
        { 'l', -40, 3, 2.0, "loan" },
    };
    printf("sizeof %lu align %lu\n", (unsigned long)sizeof(struct account), (unsigned long)_Alignof(struct account));
    printf("kind %lu balance %lu code %lu rate %lu label %lu\n",
           (unsigned long)__builtin_offsetof(struct account, kind),
           (unsigned long)__builtin_offsetof(struct account, balance),
           (unsigned long)__builtin_offsetof(struct account, code),
           (unsigned long)__builtin_offsetof(struct account, rate),
           (unsigned long)__builtin_offsetof(struct account, label));
    bump(&rows[1], 5);
    printf("sum %d tag %d projected %g label_length %d\n", sum_balances(rows, 3), tag(&rows[2]), projected(&rows[1]), label_length(&rows[1]));
    return 0;
}
