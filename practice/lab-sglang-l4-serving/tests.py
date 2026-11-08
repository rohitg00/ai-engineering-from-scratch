import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

KEYS = [
    "saturation_default",
    "saturation_fp8",
    "slo_concurrency_default",
    "best_goodput_concurrency_default",
    "fp8_speedup_c32",
    "chunk_ttft_change_pct",
    "chunk_throughput_change_pct",
    "chunk_overlap_rates",
]


@check("examples", "gains of the first three default points", "The gain of a step is the new value divided by the previous value, minus 1.")
def example_gains(sub):
    close(sub.gains([13.42, 31.2, 61.54]), [1.32488823, 0.9724359], rtol=1e-6, what="the gains")


@check("examples", "saturation point of a short series", "Return the last level before the first step whose gain is below min_gain.")
def example_saturation(sub):
    equal(sub.saturation_point([1, 2, 4, 8], [10.0, 20.0, 20.5, 30.0]), 2, what="the saturation point")


@check("examples", "the default model saturates at concurrency 32", "On the L4, output throughput falls from concurrency 32 to 64, so the rule stops at 32.")
def example_answer(sub):
    result = sub.answers()
    true(isinstance(result, dict), "answers() must return a dict", "dict", type(result).__name__)
    close(result.get("saturation_default"), 32.0, what="saturation_default")


@check("properties", "answers has every key and only numbers", "The checks read one number for each question. A missing key or a None value fails.")
def answer_keys(sub):
    result = sub.answers()
    equal(sorted(result.keys()), sorted(KEYS), what="the keys of answers()")
    for key in KEYS:
        true(isinstance(result[key], (int, float)) and np.isfinite(result[key]), f"{key} must be a finite number", "a number", result[key])


@check("properties", "gains has one value less than the series", "A series of n points has n minus 1 steps.")
def gains_length(sub):
    ys = [3.0, 6.0, 9.0, 9.0, 4.5]
    close(sub.gains(ys), [1.0, 0.5, 0.0, -0.5], what="the gains")


@check("properties", "the saturation point does not depend on the unit", "The rule uses a relative gain. Tokens per second and tokens per minute must give the same point.")
def scale_invariance(sub):
    xs = [1, 2, 4, 8, 16]
    ys = [0.010, 0.019, 0.0195, 0.03, 0.031]
    first = sub.saturation_point(xs, ys)
    equal(sub.saturation_point(xs, [y * 6000.0 for y in ys]), first, what="the saturation point after a change of unit")
    equal(first, 2, what="the saturation point")


@check("properties", "pct_change is zero for equal values and has the sign of the change", "pct_change is 100 times (new minus old) divided by old.")
def pct_properties(sub):
    close(sub.pct_change(5.0, 5.0), 0.0, what="pct_change(5, 5)")
    close(sub.pct_change(110.0, 100.0), 10.0, what="pct_change(110, 100)")
    close(sub.pct_change(50.0, 200.0), -75.0, what="pct_change(50, 200)")


@check("properties", "ranges_overlap is symmetric", "Range a overlaps range b exactly when range b overlaps range a.")
def overlap_symmetric(sub):
    a = {"min": 1.0, "max": 3.0}
    b = {"min": 2.5, "max": 9.0}
    c = {"min": 4.0, "max": 5.0}
    equal(bool(sub.ranges_overlap(a, b)), True, what="ranges_overlap(a, b)")
    equal(bool(sub.ranges_overlap(b, a)), True, what="ranges_overlap(b, a)")
    equal(bool(sub.ranges_overlap(a, c)), False, what="ranges_overlap(a, c)")
    equal(bool(sub.ranges_overlap(c, a)), False, what="ranges_overlap(c, a)")


@check("properties", "the inputs are not changed", "A helper that writes into its input list changes the data for the next question.")
def inputs_unchanged(sub):
    xs = [1, 2, 4]
    ys = [5.0, 9.0, 9.1]
    sub.gains(ys)
    sub.saturation_point(xs, ys)
    sub.largest_within(xs, ys, 9.0)
    equal(xs, [1, 2, 4], what="xs after the calls")
    equal(ys, [5.0, 9.0, 9.1], what="ys after the calls")


@check("edge", "a gain equal to min_gain still counts as a rise", "The rule stops only when the gain is strictly below min_gain.")
def gain_equal_threshold(sub):
    equal(sub.saturation_point([1, 2, 4], [100.0, 150.0, 225.0], min_gain=0.5), 4, what="the saturation point")


@check("edge", "a series that always rises returns its last level", "If no step has a gain below min_gain, the sweep did not reach saturation. Return the largest level in xs.")
def never_saturates(sub):
    equal(sub.saturation_point([1, 2, 4, 8], [1.0, 2.0, 4.0, 8.0]), 8, what="the saturation point")


@check("edge", "a value equal to the limit meets the limit", "An SLO of 1000 ms passes when the latency is exactly 1000 ms.")
def limit_inclusive(sub):
    equal(sub.largest_within([1, 2, 4, 8], [100.0, 900.0, 1000.0, 1200.0], 1000.0), 4, what="the largest level within the limit")


@check("edge", "no level within the limit gives None", "When every value is above the limit, no level meets the SLO.")
def none_within(sub):
    equal(sub.largest_within([1, 2], [2000.0, 3000.0], 1000.0), None, what="the largest level within the limit")


@check("edge", "ranges that touch at one point overlap", "Two seed ranges that share an end point overlap.")
def touching_ranges(sub):
    equal(bool(sub.ranges_overlap({"min": 1.0, "max": 2.0}, {"min": 2.0, "max": 3.0})), True, what="ranges_overlap for touching ranges")


@fixture("series")
def series(ref):
    rng = np.random.default_rng(7)
    for n in [3, 5, 7, 9]:
        xs = [int(2 ** i) for i in range(n)]
        ys = list(np.cumsum(rng.uniform(0.0, 10.0, size=n)) + 1.0)
        ys = [float(y) for y in ys]
        old = float(rng.uniform(10.0, 100.0))
        new = float(rng.uniform(10.0, 100.0))
        yield {"xs": xs, "ys": ys, "old": old, "new": new}, {
            "gains": ref.gains(ys),
            "saturation": ref.saturation_point(xs, ys, 0.1),
            "within": ref.largest_within(xs, ys, float(np.median(ys))),
            "pct": ref.pct_change(new, old),
        }


@fixture("answers")
def answer_fixture(ref):
    yield {}, ref.answers()


@check("reference", "helpers match the reference on random series", "Your helpers give the same values as the reference on four random series.")
def reference_helpers(sub):
    for case, expected in fixtures("series"):
        n = len(case["xs"])
        close(sub.gains(case["ys"]), expected["gains"], rtol=1e-9, what=f"gains for {n} points")
        equal(sub.saturation_point(case["xs"], case["ys"], 0.1), expected["saturation"], what=f"saturation_point for {n} points")
        equal(sub.largest_within(case["xs"], case["ys"], float(np.median(case["ys"]))), expected["within"], what=f"largest_within for {n} points")
        close(sub.pct_change(case["new"], case["old"]), expected["pct"], rtol=1e-9, what="pct_change")


@check("reference", "every answer matches the reference run", "Each answer must be within a relative difference of 1e-6 of the reference run on the L4 data.")
def reference_answers(sub):
    result = sub.answers()
    for case, expected in fixtures("answers"):
        for key in KEYS:
            close(result.get(key), expected[key], rtol=1e-6, what=key)
