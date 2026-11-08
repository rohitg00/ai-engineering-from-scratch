import itertools

import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

BOS = 4
EOS = 0
TABLE = {
    (4,): [0.05, 0.5, 0.4, 0.05],
    (4, 1): [0.25, 0.25, 0.25, 0.25],
    (4, 2): [0.9, 0.04, 0.03, 0.03],
}


def toy(prefix):
    return np.log(np.array(TABLE.get(tuple(prefix), [0.6, 0.2, 0.1, 0.1])))


def hashed_step(seed, vocab, eos_boost=0.0):
    def step(prefix):
        code = seed
        for token in prefix:
            code = (code * 1000003 + int(token) + 1) % 4294967291
        rng = np.random.default_rng(code)
        logits = rng.normal(size=vocab) * 1.5
        logits[EOS] += eos_boost
        return logits - np.log(np.sum(np.exp(logits)))
    return step


def greedy(step_fn, bos, eos, max_len):
    tokens = (bos,)
    score = 0.0
    for _ in range(max_len):
        log_probs = np.asarray(step_fn(tokens), dtype=float)
        token = int(np.argmax(log_probs))
        tokens = tokens + (token,)
        score += float(log_probs[token])
        if token == eos:
            break
    return tokens, score


def exhaustive(step_fn, bos, eos, vocab, max_len):
    best = None
    for length in range(1, max_len + 1):
        for tail in itertools.product(range(vocab), repeat=length):
            if eos in tail[:-1]:
                continue
            if length < max_len and tail[-1] != eos:
                continue
            tokens = (bos,) + tail
            score = sum(float(step_fn(tokens[:i])[tokens[i]]) for i in range(1, len(tokens)))
            if best is None or score > best[1] + 1e-12:
                best = (tokens, score)
    return best


def as_pairs(result, what):
    true(isinstance(result, (list, tuple)) and len(result) > 0, f"beam_search must return a non-empty list for {what}", "a list of (tokens, score) pairs", result)
    return [(tuple(int(t) for t in tokens), float(score)) for tokens, score in result]


def check_pairs(got, expected, what):
    equal([tokens for tokens, _ in got], [tuple(tokens) for tokens, _ in expected], what=f"the ranked sequences for {what}")
    close([score for _, score in got], [score for _, score in expected], rtol=1e-9, atol=1e-12, what=f"the scores for {what}")


@check("examples", "width 1 on the toy model", "Width 1 is greedy. After token 1 every token has probability 0.25. The tie goes to the lowest token id, which is EOS.")
def example_greedy(sub):
    got = as_pairs(sub.beam_search(toy, BOS, EOS, 1, 3), "width 1")
    check_pairs(got, [((4, 1, 0), -2.0794415416798357)], "width 1")


@check("examples", "width 2 escapes the greedy trap", "Width 2 keeps tokens 1 and 2 after the first step. Token 2 then gives EOS with probability 0.9, so 0.4 * 0.9 beats 0.5 * 0.25.")
def example_width_two(sub):
    got = as_pairs(sub.beam_search(toy, BOS, EOS, 2, 3), "width 2")
    check_pairs(got, [((4, 2, 0), -1.0216512475319812), ((4, 1, 0), -2.0794415416798357)], "width 2")


@check("examples", "width 2 with length_penalty 1.0", "The final score is the sum of log-probs divided by the number of generated tokens to the power length_penalty. BOS does not count. EOS counts.")
def example_length_penalty(sub):
    got = as_pairs(sub.beam_search(toy, BOS, EOS, 2, 3, length_penalty=1.0), "length_penalty 1.0")
    check_pairs(got, [((4, 2, 0), -0.5108256237659906), ((4, 1, 0), -1.0397207708399179)], "length_penalty 1.0")


@check("properties", "width 1 equals greedy decoding", "With one beam, each step keeps only the best token. That is greedy decoding with the lowest id winning a tie.")
def width_one_is_greedy(sub):
    for seed in range(6):
        step = hashed_step(seed, 5, eos_boost=0.5)
        got = as_pairs(sub.beam_search(step, 9, EOS, 1, 6), f"seed {seed}")
        tokens, score = greedy(step, 9, EOS, 6)
        equal(got[0][0], tokens, what=f"the best sequence for seed {seed}")
        close(got[0][1], score, rtol=1e-9, what=f"the best score for seed {seed}")


@check("properties", "a wide beam finds the exhaustive optimum and a narrow beam never beats it", "A beam that is wide enough keeps every hypothesis, so its best score is the best over all sequences. No beam can give a score above that optimum.")
def exhaustive_bound(sub):
    for seed in range(4):
        step = hashed_step(100 + seed, 3, eos_boost=0.3)
        tokens, score = exhaustive(step, 7, EOS, 3, 3)
        wide = as_pairs(sub.beam_search(step, 7, EOS, 27, 3), f"width 27, seed {seed}")
        equal(wide[0][0], tokens, what=f"the best sequence of a full beam for seed {seed}")
        close(wide[0][1], score, rtol=1e-9, what=f"the best score of a full beam for seed {seed}")
        for width in [1, 2, 3]:
            best = as_pairs(sub.beam_search(step, 7, EOS, width, 3), f"width {width}")[0][1]
            true(best <= score + 1e-9, f"width {width} gave a score above the exhaustive optimum for seed {seed}", score, best)


@check("properties", "on these step functions a wider beam does not lose", "A wider beam searches more hypotheses. On these step functions the best score for widths 1 to 4 never goes down. Beam search does not promise this for every model.")
def wider_not_worse(sub):
    for seed in [8, 1, 5]:
        step = hashed_step(seed, 6, eos_boost=0.2)
        scores = [as_pairs(sub.beam_search(step, 9, EOS, width, 5), f"width {width}")[0][1] for width in [1, 2, 3, 4]]
        true(all(b >= a - 1e-12 for a, b in zip(scores, scores[1:])), f"The best score went down as the width grew for seed {seed}", "a non-decreasing list", scores)


@check("properties", "each score is the sum of the step log-probs", "The raw score of a hypothesis is the sum of log p(token | prefix) over its generated tokens.")
def scores_are_sums(sub):
    step = hashed_step(55, 5, eos_boost=0.4)
    for tokens, score in as_pairs(sub.beam_search(step, 9, EOS, 3, 5), "seed 55"):
        expected = sum(float(step(tokens[:i])[tokens[i]]) for i in range(1, len(tokens)))
        close(score, expected, rtol=1e-9, what=f"the score of {tokens}")


@check("properties", "finished beams stop and the beam never grows past its width", "A beam that ends with EOS is finished. Never call step_fn on a prefix that ends with EOS. Each step extends at most beam_width alive beams.")
def finished_beams_stop(sub):
    base = hashed_step(77, 5, eos_boost=1.0)
    calls = []

    def recording(prefix):
        calls.append(tuple(int(t) for t in prefix))
        return base(prefix)

    result = as_pairs(sub.beam_search(recording, 9, EOS, 3, 6), "seed 77")
    true(all(prefix[-1] != EOS for prefix in calls), "step_fn was called on a prefix that ends with EOS", "no prefix that ends with 0", [p for p in calls if p[-1] == EOS])
    for length in range(1, 8):
        count = sum(1 for prefix in calls if len(prefix) == length)
        true(count <= 3, f"step_fn was called on {count} prefixes of length {length}", "at most 3", count)
    for tokens, _ in result:
        true(tokens[0] == 9 and EOS not in tokens[1:-1] and len(tokens) <= 7, f"The sequence {tokens} is not valid", "BOS first, EOS only at the end, at most max_len generated tokens", tokens)


@check("edge", "max_len 1", "With max_len 1 each hypothesis has one generated token. Unfinished beams at max_len are part of the result.")
def max_len_one(sub):
    got = as_pairs(sub.beam_search(toy, BOS, EOS, 3, 1), "max_len 1")
    check_pairs(got, [((4, 1), -0.6931471805599453), ((4, 2), -0.916290731874155), ((4, 0), -2.995732273553991)], "max_len 1")


@check("edge", "unfinished beams are returned at max_len", "When no beam reaches EOS before max_len, return the alive beams as they are.")
def no_eos(sub):
    def never_eos(prefix):
        return np.log(np.array([1e-12, 0.5, 0.3, 0.2 - 1e-12]))

    got = as_pairs(sub.beam_search(never_eos, BOS, EOS, 2, 2), "a model that never gives EOS")
    check_pairs(got, [((4, 1, 1), -1.3862943611198906), ((4, 1, 2), -1.8971199848858813)], "a model that never gives EOS")


@check("edge", "equal scores rank by the lower token ids", "Sort candidates by score, highest first. For equal scores, the sequence with the lower token ids comes first.")
def uniform_ties(sub):
    def uniform(prefix):
        return np.full(4, np.log(0.25))

    got = as_pairs(sub.beam_search(uniform, 8, 3, 2, 2), "a uniform model")
    check_pairs(got, [((8, 0, 0), -2.772588722239781), ((8, 0, 1), -2.772588722239781)], "a uniform model")


@check("edge", "EOS first ends the search at once", "When EOS is the best first token and the width is 1, the result is BOS then EOS after one step.")
def eos_first(sub):
    calls = []

    def eos_heavy(prefix):
        calls.append(tuple(prefix))
        return np.log(np.array([0.7, 0.1, 0.1, 0.1]))

    got = as_pairs(sub.beam_search(eos_heavy, BOS, EOS, 1, 5), "an EOS-first model")
    check_pairs(got, [((4, 0), -0.35667494393873245)], "an EOS-first model")
    equal(len(calls), 1, what="the number of step_fn calls")


@fixture("cases")
def cases(ref):
    settings = [(1, 6, 2, 4, 0.0, 0.0), (2, 5, 2, 5, 0.5, 0.0), (3, 7, 3, 5, 0.3, 1.0), (4, 4, 4, 6, 0.8, 0.6), (5, 6, 5, 4, 0.0, 2.0), (6, 3, 8, 4, 1.2, 1.0), (7, 8, 3, 3, -0.5, 0.0)]
    for seed, vocab, width, max_len, boost, alpha in settings:
        step = hashed_step(1000 + seed, vocab, eos_boost=boost)
        result = ref.beam_search(step, vocab, EOS, width, max_len, length_penalty=alpha)
        yield {"seed": 1000 + seed, "vocab": vocab, "width": width, "max_len": max_len, "boost": boost, "alpha": alpha}, [[list(tokens), score] for tokens, score in result]


@check("reference", "ranked hypotheses match the reference on 7 random models", "Your ranked list of sequences and scores agrees with the reference solution for many widths, lengths and length penalties.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        step = hashed_step(case["seed"], case["vocab"], eos_boost=case["boost"])
        label = f"V = {case['vocab']}, width = {case['width']}, max_len = {case['max_len']}, length_penalty = {case['alpha']}"
        got = as_pairs(sub.beam_search(step, case["vocab"], EOS, case["width"], case["max_len"], length_penalty=case["alpha"]), label)
        check_pairs(got, expected, label)
