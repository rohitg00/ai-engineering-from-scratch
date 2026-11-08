import numpy as np

import practice_check
from practice_check import check, clear_progress, close, equal, fixture, fixtures, progress, shape, true
from support import TEXT, VOCAB, encode

BUDGET = 300
TARGET = 2.55
V = len(VOCAB)
HELD_OUT_TEXT = (
    'a lexical ranking function that scores a document from query term matches while '
    'accounting for term rarity, repeated occurrences, and document length. a subword '
    'tokenization method that repeatedly merges frequent adjacent units to construct a '
    'fixed vocabulary from training text. the agreement between a system s stated '
    'confidence and the observed frequency with which predictions at that confidence are '
    'correct. a deployment strategy that exposes a new version to a limited slice of '
    'traffic or infrastructure before expanding the rollout. intermediate reasoning used '
    'to decompose a task before producing an answer. a prompt can request a visible '
    'rationale, while some systems use internal reasoning that is not returned to the '
    'user. a durable snapshot used to resume from a known boundary. in a workflow, it '
    'stores operational state and artifact references. in model training, it can store '
    'parameters, optimizer state, scheduler state, and the training position. a serving '
    'technique that divides a long prompt s prefill work into smaller schedulable pieces '
    'so prompt processing can interleave with decode work from other requests. dividing '
    'source material into retrievable units before indexing. chunk boundaries, overlap, '
    'metadata, and document structure determine whether retrieval returns enough context '
    'without flooding the prompt.'
)
_runs = {}


def fresh_run(sub, ids, seed):
    saved = list(progress())
    clear_progress()
    try:
        model = sub.train(ids, V, np.random.default_rng(seed))
        points = list(progress())
    finally:
        clear_progress()
        practice_check._progress.extend(saved)
    return model, points


def main_run(sub):
    key = id(sub)
    if key not in _runs:
        ids = encode(TEXT)
        ids_in = ids.copy()
        clear_progress()
        model = sub.train(ids_in, V, np.random.default_rng(1))
        _runs[key] = {"model": model, "points": list(progress()), "ids": ids, "ids_in": ids_in}
    return _runs[key]


def log_probs(sub, model, prev_ids):
    out = np.asarray(sub.next_log_probs(model, prev_ids), dtype=float)
    shape(out, (len(prev_ids), V), what="the log probabilities from next_log_probs")
    return out


def mean_nll(sub, model, ids):
    out = log_probs(sub, model, ids[:-1])
    return float(-np.mean(out[np.arange(ids.size - 1), ids[1:]]))


def unigram_nll(train_ids, test_ids):
    counts = np.bincount(train_ids[1:], minlength=V).astype(float)
    return float(-np.mean(np.log(counts[test_ids[1:]] / counts.sum())))


@check("examples", "one row of log probabilities for each context", "next_log_probs returns an array of shape (M, 29). Row i holds log P(next character | prev_ids[i]) for each of the 29 characters.")
def example_shape(sub):
    log_probs(sub, main_run(sub)["model"], encode("the "))


@check("examples", "the model fits the training text", "After training, the mean negative log-likelihood of the next character on the training text must be at most 2.55 nats.")
def example_train_nll(sub):
    run = main_run(sub)
    nll = mean_nll(sub, run["model"], run["ids"])
    true(nll <= TARGET, f"training negative log-likelihood {nll:.4f} is above {TARGET}", f"<= {TARGET}", nll)


@check("properties", "each row is a log probability distribution", "Each row of next_log_probs holds log probabilities. All values are at most 0, and the exponentials of a row sum to 1. Apply log softmax to the logits.")
def rows_normalized(sub):
    out = log_probs(sub, main_run(sub)["model"], np.arange(V))
    true(np.all(out <= 1e-12), "a log probability is above 0", "values <= 0", out)
    close(np.exp(out).sum(axis=1), np.ones(V), atol=1e-9, what="the sum of exp over each row")


@check("properties", "training stays inside the step budget", "Call report(step, loss) once for each update step, with step = 0, 1, 2 and so on. Use at most 300 steps.")
def budget(sub):
    points = main_run(sub)["points"]
    true(len(points) >= 1, "train did not call report(step, loss)", "at least 1 call", 0)
    true(len(points) <= BUDGET, f"train used {len(points)} steps, the budget is {BUDGET}", f"<= {BUDGET}", len(points))
    equal([point[0] for point in points], list(range(len(points))), what="the step numbers given to report")


@check("properties", "the reported loss goes down", "Gradient descent must lower the loss. The mean of the last 10 reported losses must be below the first loss.")
def loss_goes_down(sub):
    losses = np.array([point[1] for point in main_run(sub)["points"]])
    true(losses.size >= 1 and np.all(np.isfinite(losses)), "a reported loss is NaN or infinite", "finite losses", losses)
    true(np.mean(losses[-10:]) < losses[0], "the loss did not go down", f"below {losses[0]:.4f}", float(np.mean(losses[-10:])))


@check("properties", "the same seed gives the same model", "Take every random number from the rng argument. Then two runs with the same seed give the same log probabilities.")
def deterministic(sub):
    run = main_run(sub)
    model, points = fresh_run(sub, encode(TEXT), 1)
    contexts = np.arange(V)
    equal(log_probs(sub, model, contexts), log_probs(sub, run["model"], contexts), what="the log probabilities of the second run")
    equal([point[1] for point in points], [point[1] for point in run["points"]], what="the losses of the second run")


@check("properties", "the input ids are not changed", "Do not write into ids. Make new arrays for the contexts and the targets.")
def inputs_unchanged(sub):
    run = main_run(sub)
    equal(run["ids_in"], run["ids"], what="ids after train")


@check("edge", "the model learned common pairs", "The model predicts the character that follows the context. In the training text, u follows q, a space follows a full stop, and h follows t most often.")
def common_pairs(sub):
    out = log_probs(sub, main_run(sub)["model"], encode("q.t"))
    equal(np.argmax(out, axis=1).tolist(), encode("u h").tolist(), what="the most likely next character after q, . and t")


@check("edge", "an unseen pair keeps a finite log probability", "The pair b then x never occurs in the training text. Gradient descent from small logits gives it a small probability, not 0. Raw counts give minus infinity.")
def unseen_pair(sub):
    out = log_probs(sub, main_run(sub)["model"], encode("b"))
    value = out[0, VOCAB.index("x")]
    true(np.isfinite(value), "log P(x | b) is not finite", "a finite value", value)


@check("edge", "one context", "next_log_probs must work for a single context and return shape (1, 29).")
def one_context(sub):
    log_probs(sub, main_run(sub)["model"], encode("a"))


@fixture("held_out")
def reference_nll(ref):
    model = ref.train(encode(TEXT), V, np.random.default_rng(1))
    held = encode(HELD_OUT_TEXT)
    out = ref.next_log_probs(model, held[:-1])
    nll = float(-np.mean(out[np.arange(held.size - 1), held[1:]]))
    yield {"target": TARGET}, {"reference": nll, "unigram": unigram_nll(encode(TEXT), held)}


@check("reference", "held-out negative log-likelihood reaches the target", "The checks measure your model on a held-out text from other glossary entries. The mean negative log-likelihood of the next character must be at most 2.55 nats. A unigram model that ignores the context does not reach it.")
def held_out_nll(sub):
    (case, expected), = fixtures("held_out")
    nll = mean_nll(sub, main_run(sub)["model"], encode(HELD_OUT_TEXT))
    message = f"held-out negative log-likelihood {nll:.4f} is above {case['target']}. The reference reaches {expected['reference']:.4f}. A unigram model gets {expected['unigram']:.4f}"
    true(nll <= case["target"], message, f"<= {case['target']}", nll)
