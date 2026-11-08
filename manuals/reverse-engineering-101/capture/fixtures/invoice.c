#include <stdio.h>
#include <stdlib.h>

static int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (after - before) * 100 / before;
}

int main(int argc, char **argv) {
    if (argc != 3) {
        fprintf(stderr, "usage: invoice <april> <may>\n");
        return 2;
    }
    int april = atoi(argv[1]);
    int may = atoi(argv[2]);
    printf("change %d (%d%%)\n", may - april, percent_change(april, may));
    return 0;
}
