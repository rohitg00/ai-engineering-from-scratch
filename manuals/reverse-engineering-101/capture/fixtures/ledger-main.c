#include <stdio.h>
#include <stdlib.h>

int percent_change(int before, int after);
int grade(int score);
int total(const int *values, int count);
const char *grade_label(int score);

int main(int argc, char **argv) {
    if (argc < 3) {
        fprintf(stderr, "usage: ledger <before> <after> [score...]\n");
        return 2;
    }
    int before = atoi(argv[1]);
    int after = atoi(argv[2]);
    int scores[16];
    int count = 0;
    for (int i = 3; i < argc && count < 16; i++) scores[count++] = atoi(argv[i]);
    printf("change %d%%\n", percent_change(before, after));
    printf("total %d\n", total(scores, count));
    for (int i = 0; i < count; i++) printf("score %d grade %s\n", scores[i], grade_label(scores[i]));
    return 0;
}
