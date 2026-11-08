#include "ledger.c"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    if (argc < 2) return 2;
    if (strcmp(argv[1], "percent_change") == 0 && argc == 4) {
        printf("%d\n", percent_change(atoi(argv[2]), atoi(argv[3])));
        return 0;
    }
    if (strcmp(argv[1], "grade") == 0 && argc == 3) {
        printf("%d\n", grade(atoi(argv[2])));
        return 0;
    }
    if (strcmp(argv[1], "grade_label") == 0 && argc == 3) {
        printf("%s\n", grade_label(atoi(argv[2])));
        return 0;
    }
    if (strcmp(argv[1], "total") == 0) {
        int count = argc - 2;
        int *values = malloc(sizeof(int) * (count > 0 ? count : 1));
        if (values == NULL) return 3;
        for (int i = 0; i < count; i++) values[i] = atoi(argv[2 + i]);
        printf("%d\n", total(values, count));
        free(values);
        return 0;
    }
    return 2;
}
