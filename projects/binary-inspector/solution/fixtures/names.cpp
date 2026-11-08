namespace tally {

struct Counter {
    int count;
    int add(int by);
    int total() const;
};

int Counter::add(int by) {
    count += by;
    return count;
}

int Counter::total() const {
    return count;
}

double scale(double value, int percent) {
    return value * percent / 100.0;
}

void reset(Counter *counter) {
    counter->count = 0;
}

long clamp(long value, long low, long high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
}

}
