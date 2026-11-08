import numpy as np

from practice_check import check, equal, fixture, fixtures, true

UNITS = {(1, 2, 3): 5, (1, 2): 3, (2, 3, 2, 3): 2}
WORDS = {(108, 111, 119): 5, (108, 111, 119, 101, 114): 2, (110, 101, 119, 101, 115, 116): 6, (119, 105, 100, 101, 115, 116): 3}


def weighted_length(units):
    return sum(len(symbols) * count for symbols, count in units.items())


def random_units(rng, words, alphabet, max_len, max_count):
    units = {}
    for _ in range(words):
        length = int(rng.integers(1, max_len + 1))
        symbols = tuple(int(v) for v in rng.integers(0, alphabet, size=length))
        units[symbols] = units.get(symbols, 0) + int(rng.integers(1, max_count + 1))
    return units


@check("examples", "pair counts of the small corpus", "Each adjacent pair in a word counts once for each time the word appears. Add the word frequency, not 1.")
def example_counts(sub):
    equal(sub.count_pairs(UNITS), {(1, 2): 8, (2, 3): 9, (3, 2): 2}, what="count_pairs(units)")


@check("examples", "best pair of the small corpus", "The best pair is the pair with the highest count.")
def example_best(sub):
    equal(sub.best_pair({(1, 2): 8, (2, 3): 9, (3, 2): 2}), (2, 3), what="best_pair(pairs)")


@check("examples", "merge does not overlap", "Scan from left to right. After a match, skip both symbols, so [7, 7, 7] with the pair (7, 7) gives [300, 7].")
def example_merge(sub):
    equal(sub.apply_merge((7, 7, 7), (7, 7), 300), (300, 7), what="apply_merge((7, 7, 7), (7, 7), 300)")


@check("examples", "four merges on the word corpus", "The pairs (101, 115) and (115, 116) both have count 9. The smaller pair wins the tie.")
def example_train(sub):
    merges, units = sub.train(dict(WORDS), 4)
    equal(merges, [((101, 115), 256), ((256, 116), 257), ((108, 111), 258), ((258, 119), 259)], what="the merge list")
    equal(units, {(259,): 5, (259, 101, 114): 2, (110, 101, 119, 257): 6, (119, 105, 100, 257): 3}, what="the merged units")


@check("properties", "the total pair count matches the word lengths", "A word of length L has L - 1 adjacent pairs. The sum of all pair counts is the sum of (L - 1) times the word frequency.")
def total_pairs(sub):
    rng = np.random.default_rng(3)
    units = random_units(rng, 30, 5, 8, 6)
    pairs = sub.count_pairs(units)
    expected = sum((len(symbols) - 1) * count for symbols, count in units.items())
    equal(sum(pairs.values()), expected, what="the sum of the pair counts")


@check("properties", "each merge makes the corpus shorter", "A merge replaces two symbols with one, so the weighted length of the corpus goes down after every merge. The word frequencies keep their sum.")
def merges_shrink(sub):
    rng = np.random.default_rng(4)
    units = random_units(rng, 25, 4, 7, 5)
    total = sum(units.values())
    previous = weighted_length(units)
    for steps in range(1, 6):
        merges, merged = sub.train(dict(units), steps)
        true(len(merges) == steps, f"train stopped after {len(merges)} merges, but the corpus still has pairs with count 2 or more", steps, len(merges))
        now = weighted_length(merged)
        true(now < previous, f"merge {steps} did not make the corpus shorter", f"less than {previous}", now)
        equal(sum(merged.values()), total, what=f"the sum of the word frequencies after {steps} merges")
        previous = now


@check("properties", "new ids count up from first_id", "Merge number i gets the id first_id + i. The ids do not skip and do not repeat.")
def ids_count_up(sub):
    merges, _ = sub.train(dict(WORDS), 6, first_id=1000)
    equal([new_id for _, new_id in merges], list(range(1000, 1000 + len(merges))), what="the new ids")


@check("properties", "replaying the merges gives the trained corpus", "Encoding applies the merges in training order. Each word of the corpus must then match the trained units.")
def replay(sub):
    rng = np.random.default_rng(5)
    units = random_units(rng, 20, 4, 9, 4)
    merges, trained = sub.train(dict(units), 8)
    replayed = {}
    for symbols, count in units.items():
        for pair, new_id in merges:
            symbols = sub.apply_merge(symbols, pair, new_id)
        replayed[tuple(symbols)] = replayed.get(tuple(symbols), 0) + count
    equal(replayed, trained, what="the corpus after you apply each merge in order")


@check("properties", "the input corpus is not changed", "train must build a new dict. The caller keeps the original corpus to encode it again.")
def input_unchanged(sub):
    units = dict(WORDS)
    sub.train(units, 3)
    sub.count_pairs(units)
    equal(units, WORDS, what="the corpus dict after the calls")


@check("edge", "runs of one symbol merge in pairs", "Non-overlapping merges turn four equal symbols into two new symbols and five into two new symbols and one old symbol.")
def runs(sub):
    equal(sub.apply_merge((4, 4, 4, 4), (4, 4), 9), (9, 9), what="apply_merge((4, 4, 4, 4), (4, 4), 9)")
    equal(sub.apply_merge((4, 4, 4, 4, 4), (4, 4), 9), (9, 9, 4), what="apply_merge((4, 4, 4, 4, 4), (4, 4), 9)")
    equal(sub.apply_merge((1, 2, 1, 2, 1), (1, 2), 300), (300, 300, 1), what="apply_merge((1, 2, 1, 2, 1), (1, 2), 300)")


@check("edge", "short and empty inputs", "A word with one symbol has no pairs. An empty pair table has no best pair, so best_pair returns None.")
def short_inputs(sub):
    equal(sub.apply_merge((), (1, 2), 9), (), what="apply_merge((), (1, 2), 9)")
    equal(sub.apply_merge((5,), (5, 5), 9), (5,), what="apply_merge((5,), (5, 5), 9)")
    equal(sub.count_pairs({(5,): 3}), {}, what="count_pairs({(5,): 3})")
    equal(sub.count_pairs({}), {}, what="count_pairs({})")
    equal(sub.best_pair({}), None, what="best_pair({})")


@check("edge", "ties go to the smallest pair", "Compare tied pairs as tuples. (2, 9) comes before (5, 1) because 2 is less than 5.")
def ties(sub):
    equal(sub.best_pair({(5, 1): 4, (2, 9): 4, (3, 3): 1}), (2, 9), what="best_pair with a tie at count 4")
    equal(sub.best_pair({(3, 8): 2, (3, 4): 2}), (3, 4), what="best_pair with a tie on the first id")


@check("edge", "training stops when no pair repeats", "A merge needs a pair count of 2 or more. When the best count is 1 or the corpus has no pairs, train stops early.")
def stops_early(sub):
    equal(sub.train({(1, 2): 1}, 3), ([], {(1, 2): 1}), what="train({(1, 2): 1}, 3)")
    equal(sub.train({(1, 2, 3, 4): 1, (3, 4): 1}, 5), ([((3, 4), 256)], {(1, 2, 256): 1, (256,): 1}), what="train on a corpus with one repeated pair")
    equal(sub.train({(7,): 4}, 2), ([], {(7,): 4}), what="train on one-symbol words")
    equal(sub.train(dict(WORDS), 0), ([], WORDS), what="train with num_merges = 0")


@fixture("pairs")
def pair_cases(ref):
    rng = np.random.default_rng(11)
    for words, alphabet in [(5, 3), (12, 4), (20, 6)]:
        units = random_units(rng, words, alphabet, 8, 7)
        yield {"units": units}, ref.count_pairs(units)


@fixture("merges")
def merge_cases(ref):
    rng = np.random.default_rng(12)
    for length, alphabet in [(6, 2), (15, 2), (25, 3), (40, 3)]:
        symbols = tuple(int(v) for v in rng.integers(0, alphabet, size=length))
        pair = (int(rng.integers(0, alphabet)), int(rng.integers(0, alphabet)))
        yield {"symbols": symbols, "pair": pair}, ref.apply_merge(symbols, pair, 99)


@fixture("training")
def train_cases(ref):
    rng = np.random.default_rng(13)
    for words, alphabet, steps in [(10, 3, 5), (30, 5, 12), (40, 4, 20)]:
        units = random_units(rng, words, alphabet, 9, 6)
        merges, trained = ref.train(dict(units), steps)
        yield {"units": units, "steps": steps}, {"merges": merges, "units": trained}


@check("reference", "pair counts match the reference", "Your pair counts agree with the reference on random weighted corpora.")
def reference_pairs(sub):
    for case, expected in fixtures("pairs"):
        equal(sub.count_pairs(case["units"]), expected, what=f"count_pairs on a corpus of {len(case['units'])} words")


@check("reference", "merges match the reference", "Your merge agrees with the reference on random sequences with long runs.")
def reference_merges(sub):
    for case, expected in fixtures("merges"):
        equal(tuple(sub.apply_merge(case["symbols"], case["pair"], 99)), expected, what=f"apply_merge on {case['symbols']} with the pair {case['pair']}")


@check("reference", "training matches the reference", "Your merge list and final corpus agree with the reference on random corpora.")
def reference_train(sub):
    for case, expected in fixtures("training"):
        merges, units = sub.train(dict(case["units"]), case["steps"])
        equal(merges, expected["merges"], what=f"the merge list for {case['steps']} merges")
        equal(units, expected["units"], what=f"the corpus after {case['steps']} merges")
