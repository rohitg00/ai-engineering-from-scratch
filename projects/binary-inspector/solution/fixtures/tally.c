int tally_version = 3;
int tally_counter;

static const char *const bucket_names[] = { "low", "mid", "high", "peak" };

int tally_sum(const int *values, int count) {
    int sum = 0;
    for (int i = 0; i < count; i++) sum += values[i];
    tally_counter += count;
    return sum;
}

int tally_scale(int value, int percent) {
    return value * percent / 100;
}

int tally_bucket(int value) {
    switch (value / 25) {
    case 0: return 0;
    case 1: return 1;
    case 2: return 2;
    default: return 3;
    }
}

const char *tally_name(int bucket) {
    if (bucket < 0 || bucket > 3) return "unknown bucket";
    return bucket_names[bucket];
}

unsigned tally_checksum(const char *text) {
    unsigned hash = 2166136261u;
    while (*text) {
        hash ^= (unsigned char)*text++;
        hash *= 16777619u;
    }
    return hash;
}
