int printf(const char *format, ...);
int puts(const char *text);

int meter_clamp(int value, int low, int high);
int meter_average(const int *samples, int count);
int meter_level(int percent);
const char *meter_level_name(int level);
unsigned meter_hash(const char *text);
extern int meter_limit;

static const char title[] = "meter readout";

int main(int argc, char **argv) {
    int samples[] = { 7, 42, 63, 88, 100 };
    int average = meter_average(samples, 5);
    (void)argv;
    puts(title);
    printf("average=%d level=%s\n", average, meter_level_name(meter_level(average)));
    for (int i = 0; i < 5; i++) {
        printf("%d%% -> %s\n", samples[i], meter_level_name(meter_level(samples[i])));
    }
    printf("hash=%08x limit=%d\n", meter_hash(title), meter_limit);
    if (argc > 2) puts("too many arguments");
    return 0;
}
