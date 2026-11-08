def count_pairs(units):
    pairs = {}
    for symbols, count in units.items():
        for i in range(len(symbols) - 1):
            pair = (symbols[i], symbols[i + 1])
            pairs[pair] = pairs.get(pair, 0) + count
    return pairs


def best_pair(pairs):
    if not pairs:
        return None
    max_count = max(pairs.values())
    candidates = sorted(p for p, c in pairs.items() if c == max_count)
    return candidates[0]


def apply_merge(symbols, pair, new_id):
    out = []
    i = 0
    a, b = pair
    while i < len(symbols):
        if i < len(symbols) - 1 and symbols[i] == a and symbols[i + 1] == b:
            out.append(new_id)
            i += 2
        else:
            out.append(symbols[i])
            i += 1
    return tuple(out)


def train(units, num_merges, first_id=256):
    merges = []
    new_id = first_id
    for _ in range(num_merges):
        pairs = count_pairs(units)
        best = best_pair(pairs)
        if best is None:
            break
        merged_units = {}
        for symbols, count in units.items():
            merged = apply_merge(symbols, best, new_id)
            merged_units[merged] = merged_units.get(merged, 0) + count
        units = merged_units
        merges.append((best, new_id))
        new_id += 1
    return merges, units
