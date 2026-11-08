import sys
from datetime import datetime

WINDOW = 60
PERIOD = 30
LIMIT = 100
DEAD_RATE_PER_MINUTE = 2669


def load(path):
    counts = {}
    for line in open(path):
        count, day, clock = line.split()
        stamp = datetime.fromisoformat(f"{day} {clock}")
        counts[stamp] = counts.get(stamp, 0) + int(count)
    start = min(counts)
    length = int((max(counts) - start).total_seconds()) + 1
    per_second = [0] * length
    for stamp, count in counts.items():
        per_second[int((stamp - start).total_seconds())] += count
    return start, per_second


def replay(per_second, checks, offset):
    prefix = [0]
    for count in per_second:
        prefix.append(prefix[-1] + count)
    end = len(per_second)

    def window(t):
        hi = min(max(t, 0), end)
        lo = min(max(t - WINDOW, 0), end)
        return prefix[hi] - prefix[lo]

    strikes = 0
    longest = 0
    t = offset
    while t < end + WINDOW + PERIOD:
        strikes = strikes + 1 if window(t) > LIMIT else 0
        longest = max(longest, strikes)
        if strikes >= checks:
            return longest, t
        t += PERIOD
    return longest, None


def main(path):
    start, healthy = load(path)
    dead = [DEAD_RATE_PER_MINUTE // 60] * 3600
    print(f"healthy run: {sum(healthy)} errors from {start}, checks every {PERIOD} s over the last {WINDOW} s, limit {LIMIT}")
    print("checks  healthy offsets stopped  most checks in a row  dead engine stopped after")
    for checks in (6, 8, 10):
        results = [replay(healthy, checks, offset) for offset in range(PERIOD)]
        stopped = [t for _, t in results if t is not None]
        longest = max(n for n, _ in results)
        dead_stops = [replay(dead, checks, offset)[1] for offset in range(PERIOD)]
        print(f"{checks:>6}  {len(stopped):>2} of {PERIOD:<21} {longest:<21} {min(dead_stops)} to {max(dead_stops)} s")


if __name__ == "__main__":
    main(sys.argv[1])
