int percent_change(int before, int after);
int grade(int score);
int total(const int *values, int count);
const char *grade_label(int score);
int printf(const char *fmt, ...);
int puts(const char *s);

static const char *const names[] = { "even", "odd" };
int (*const fns[])(int) = { grade, grade };

int main(int argc, char **argv) {
    int v[] = { 1, 2, 3, 4 };
    (void)argv;
    puts(names[argc & 1]);
    printf("%d\n", fns[argc & 1](72));
    printf("%d %d %d %s\n", percent_change(100, 150), grade(85), total(v, 4), grade_label(85));
    if (argc > 1) puts("args");
    return 0;
}
