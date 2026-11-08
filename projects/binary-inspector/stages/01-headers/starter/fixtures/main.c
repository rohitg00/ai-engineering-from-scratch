int printf(const char *format, ...);
int puts(const char *text);

int tally_sum(const int *values, int count);
int tally_scale(int value, int percent);
int tally_bucket(int value);
const char *tally_name(int bucket);
unsigned tally_checksum(const char *text);
extern int tally_version;

static const char banner[] = "tally report v3";

int main(int argc, char **argv) {
    int values[] = { 12, 30, 45, 90 };
    int sum = tally_sum(values, 4);
    (void)argv;
    puts(banner);
    printf("sum=%d scaled=%d\n", sum, tally_scale(sum, 50));
    for (int i = 0; i < 4; i++) {
        printf("%d -> %s\n", values[i], tally_name(tally_bucket(values[i])));
    }
    printf("checksum=%08x version=%d\n", tally_checksum(banner), tally_version);
    if (argc > 1) puts("extra arguments ignored");
    return 0;
}
