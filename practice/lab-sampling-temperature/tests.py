import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true
from support import LOGITS

KEYS = ["entropy_t1", "top1_t07", "first_grid_temperature", "crossing_temperature", "kept_p09_t07", "kept_p09_t10", "kept_p09_t15"]


@check("examples", "softmax of [1, 2, 3] at temperature 0.5", "Divide the logits by the temperature, then take the softmax.")
def example_softmax(sub):
    close(sub.softmax_t(np.array([1.0, 2.0, 3.0]), 0.5), [0.01587624, 0.11731043, 0.86681333], rtol=1e-6, what="the probabilities")


@check("examples", "entropy of [0.5, 0.25, 0.25] is 1.5 bits", "Entropy in bits is minus the sum of p times log2 p.")
def example_entropy(sub):
    close(sub.entropy_bits(np.array([0.5, 0.25, 0.25])), 1.5, what="the entropy")


@check("examples", "the sweep at three temperatures", "Each temperature gives one entropy and one top 1 probability.")
def example_sweep(sub):
    entropies, top1 = sub.sweep_temperature(LOGITS, [0.5, 1.0, 2.0])
    close(entropies, [1.50271532, 2.52573217, 3.09650953], rtol=1e-6, what="the entropies")
    close(top1, [0.61269561, 0.38024152, 0.22636197], rtol=1e-6, what="the top 1 probabilities")


@check("examples", "top p 0.8 keeps 2 tokens of [0.1, 0.6, 0.3]", "Sort the probabilities from high to low and keep the shortest prefix whose sum reaches p.")
def example_kept(sub):
    equal(int(sub.kept_count(np.array([0.1, 0.6, 0.3]), 0.8)), 2, what="the kept count")


@check("properties", "answers has every key and only numbers", "The checks read one finite number for each question.")
def answer_keys(sub):
    result = sub.answers()
    equal(sorted(result.keys()), sorted(KEYS), what="the keys of answers()")
    for key in KEYS:
        true(isinstance(result[key], (int, float)) and np.isfinite(result[key]), f"{key} must be a finite number", "a number", result[key])


@check("properties", "entropy rises and top 1 falls as the temperature rises", "A higher temperature makes the logits closer together, so the distribution gets flatter.")
def monotone(sub):
    entropies, top1 = sub.sweep_temperature(LOGITS, [0.2, 0.5, 1.0, 2.0, 5.0])
    shape(entropies, (5,), what="the entropies")
    true(np.all(np.diff(entropies) > 0), "the entropy must rise with the temperature", "rising values", entropies)
    true(np.all(np.diff(top1) < 0), "the top 1 probability must fall with the temperature", "falling values", top1)


@check("properties", "entropy stays between 0 and log2 of the vocabulary size", "A distribution over V tokens has an entropy from 0 bits to log2(V) bits.")
def entropy_bounds(sub):
    rng = np.random.default_rng(4)
    for t in [0.05, 1.0, 50.0]:
        h = sub.entropy_bits(sub.softmax_t(rng.normal(size=12) * 3, t))
        true(-1e-12 <= h <= np.log2(12) + 1e-12, f"the entropy at temperature {t} is out of range", f"from 0 to {np.log2(12):.4f}", h)
    close(sub.entropy_bits(np.full(8, 0.125)), 3.0, what="the entropy of a uniform distribution over 8 tokens")


@check("properties", "the crossing temperature gives the target entropy", "Bisection finds the temperature where the entropy equals the target.")
def crossing(sub):
    t = sub.temperature_for_entropy(LOGITS, 2.0)
    close(sub.entropy_bits(sub.softmax_t(LOGITS, t)), 2.0, atol=1e-6, what="the entropy at the crossing temperature")


@check("properties", "the inputs are not changed", "A sampler that writes into the logits changes the next step of the decoder.")
def inputs_unchanged(sub):
    logits = LOGITS.copy()
    probs = np.array([0.1, 0.6, 0.3])
    saved = probs.copy()
    sub.softmax_t(logits, 0.5)
    sub.sweep_temperature(logits, [0.5, 2.0])
    sub.kept_count(probs, 0.8)
    close(logits, LOGITS, atol=0, rtol=0, what="the logits after the calls")
    close(probs, saved, atol=0, rtol=0, what="the probabilities after the call")


@check("edge", "large logits at a small temperature do not overflow", "Subtract the maximum of the scaled logits before np.exp.")
def large_logits(sub):
    probs = sub.softmax_t(np.array([1000.0, 999.0, 990.0]), 0.1)
    close(np.sum(probs), 1.0, what="the sum of the probabilities")
    close(probs[0], 0.9999546021312976, rtol=1e-9, what="the top probability")


@check("edge", "a zero probability adds 0 to the entropy", "Use the rule 0 times log 0 equals 0. np.log2(0) is minus infinity.")
def zero_prob(sub):
    close(sub.entropy_bits(np.array([1.0, 0.0, 0.0])), 0.0, what="the entropy of a one hot distribution")
    close(sub.entropy_bits(np.array([0.5, 0.5, 0.0])), 1.0, what="the entropy with one zero")


@check("edge", "a sum equal to p keeps the token that reaches p", "The rule is a cumulative sum greater than or equal to p.")
def exact_p(sub):
    equal(int(sub.kept_count(np.array([0.25, 0.5, 0.25]), 0.75)), 2, what="the kept count")


@check("edge", "p equal to 1 keeps every token", "When rounding keeps the sum below p, keep every token.")
def p_one(sub):
    probs = np.array([0.3, 0.3, 0.3, 0.1 - 1e-12])
    equal(int(sub.kept_count(probs, 1.0)), 4, what="the kept count")


@fixture("logits")
def logit_cases(ref):
    rng = np.random.default_rng(9)
    for v in [3, 7, 16]:
        logits = rng.normal(size=v) * 2.0
        temps = [0.3, 0.8, 1.7]
        entropies, top1 = ref.sweep_temperature(logits, temps)
        yield {"logits": logits, "temps": temps}, {
            "entropies": entropies,
            "top1": top1,
            "kept": [ref.kept_count(ref.softmax_t(logits, t), 0.9) for t in temps],
            "crossing": ref.temperature_for_entropy(logits, 0.6 * np.log2(v)),
        }


@fixture("answers")
def answer_fixture(ref):
    yield {}, ref.answers()


@check("reference", "helpers match the reference on random logits", "Your entropies, top 1 probabilities, kept counts and crossing temperatures match the reference.")
def reference_helpers(sub):
    for case, expected in fixtures("logits"):
        v = case["logits"].size
        entropies, top1 = sub.sweep_temperature(case["logits"], case["temps"])
        close(entropies, expected["entropies"], rtol=1e-9, what=f"the entropies for {v} tokens")
        close(top1, expected["top1"], rtol=1e-9, what=f"the top 1 probabilities for {v} tokens")
        close([sub.kept_count(sub.softmax_t(case["logits"], t), 0.9) for t in case["temps"]], expected["kept"], what=f"the kept counts for {v} tokens")
        close(sub.temperature_for_entropy(case["logits"], 0.6 * np.log2(v)), expected["crossing"], rtol=1e-6, what=f"the crossing temperature for {v} tokens")


@check("reference", "every answer matches the reference run", "Each answer must be within a relative difference of 1e-6 of the reference run.")
def reference_answers(sub):
    result = sub.answers()
    for case, expected in fixtures("answers"):
        for key in KEYS:
            close(result.get(key), expected[key], rtol=1e-6, what=key)
