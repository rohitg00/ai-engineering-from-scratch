int meter_limit = 100;
int meter_samples_seen;

static const char *const level_names[] = { "empty", "low", "half", "high", "full" };

int meter_clamp(int value, int low, int high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
}

int meter_average(const int *samples, int count) {
    int sum = 0;
    if (count <= 0) return 0;
    for (int i = 0; i < count; i++) sum += samples[i];
    meter_samples_seen += count;
    return sum / count;
}

int meter_level(int percent) {
    switch (meter_clamp(percent, 0, meter_limit) / 20) {
    case 0: return 0;
    case 1: return 1;
    case 2: return 2;
    case 3: return 3;
    default: return 4;
    }
}

const char *meter_level_name(int level) {
    if (level < 0 || level > 4) return "out of range";
    return level_names[level];
}

unsigned meter_hash(const char *text) {
    unsigned hash = 5381u;
    while (*text) hash = hash * 33u + (unsigned char)*text++;
    return hash;
}
