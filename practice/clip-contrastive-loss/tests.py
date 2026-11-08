import numpy as np

from practice_check import check, close, fixture, fixtures, numeric_grad, shape, true

I3 = np.array([[1.0, 0.0], [0.0, 2.0], [1.0, 1.0]])
T3 = np.array([[2.0, 0.0], [1.0, 1.0], [0.0, 3.0]])
S3 = np.array([[2.0, 1.41421356237309515, 0.0], [0.0, 1.41421356237309515, 2.0], [1.41421356237309515, 2.0, 1.41421356237309515]])


@check("examples", "the similarity logits of three pairs", "Divide each embedding by its L2 norm. The logits are the image rows times the text rows transposed, divided by the temperature.")
def example_logits(sub):
    close(sub.similarity_logits(I3, T3, 0.5), S3, rtol=1e-8, atol=1e-12, what="the logits")


@check("examples", "the symmetric loss and its gradient", "The loss is the mean of two cross-entropies. The image loss reads each row, the text loss reads each column, and the target is the diagonal.")
def example_loss(sub):
    close(sub.symmetric_infonce(S3), 0.9905556060000382, rtol=1e-9, what="the loss")
    close(sub.symmetric_infonce_grad(S3), [[-0.13632819, 0.09873442, 0.02666175], [0.02666175, -0.23459891, 0.19700514], [0.09873442, 0.15772852, -0.23459891]], rtol=1e-6, what="the gradient")


@check("examples", "equal logits give log N", "When all logits are equal, each softmax is uniform over N items. Both cross-entropies are log N.")
def example_equal(sub):
    close(sub.symmetric_infonce(np.zeros((4, 4))), 1.3862943611198906, rtol=1e-12, what="the loss for N = 4")


@check("properties", "the loss is symmetric in the two modalities", "Swap the image and text embeddings. The logits become the transpose, and the loss does not change.")
def symmetric(sub):
    rng = np.random.default_rng(0)
    img = rng.normal(size=(6, 5))
    txt = rng.normal(size=(6, 5))
    a = sub.similarity_logits(img, txt, 0.1)
    b = sub.similarity_logits(txt, img, 0.1)
    shape(a, (6, 6), what="the logits")
    close(b, np.asarray(a).T, atol=1e-12, what="the logits with the modalities swapped")
    close(sub.symmetric_infonce(np.asarray(a).T), sub.symmetric_infonce(a), rtol=1e-12, what="the loss of the transposed logits")


@check("properties", "the logits do not depend on the length of an embedding", "Normalize each embedding first. Then each logit is a cosine similarity divided by the temperature, and it is at most 1 / temperature.")
def scale_invariant(sub):
    rng = np.random.default_rng(1)
    img = rng.normal(size=(4, 3))
    txt = rng.normal(size=(4, 3))
    scales = np.array([[0.1], [3.0], [50.0], [1.0]])
    base = np.asarray(sub.similarity_logits(img, txt, 0.07))
    close(sub.similarity_logits(img * scales, txt * scales[::-1], 0.07), base, atol=1e-10, what="the logits of rescaled embeddings")
    true(np.all(np.abs(base) <= 1 / 0.07 + 1e-9), "A logit is larger than 1 / temperature", "values from -1/0.07 to 1/0.07", base)


@check("properties", "matched pairs give a lower loss than shuffled pairs", "When each text matches its image, the diagonal is large and the loss is small. A wrong pairing moves the large values off the diagonal and the loss grows.")
def matched_lower(sub):
    rng = np.random.default_rng(2)
    img = rng.normal(size=(8, 16))
    txt = img + 0.1 * rng.normal(size=(8, 16))
    matched = sub.symmetric_infonce(sub.similarity_logits(img, txt, 0.1))
    shuffled = sub.symmetric_infonce(sub.similarity_logits(img, txt[np.roll(np.arange(8), 1)], 0.1))
    true(matched < 0.5, "The loss of well matched pairs is not small", "less than 0.5", matched)
    true(shuffled > matched + 1.0, "A wrong pairing does not raise the loss", f"more than {matched + 1.0}", shuffled)


@check("properties", "the gradient matches finite differences", "The gradient of each cross-entropy is the softmax minus the one-hot target. The text term uses the column softmax. Average the two terms and divide by N.")
def gradient(sub):
    rng = np.random.default_rng(3)
    logits = rng.normal(size=(5, 5)) * 2.0
    grad = sub.symmetric_infonce_grad(logits)
    close(grad, numeric_grad(sub.symmetric_infonce, logits, eps=1e-6), rtol=1e-5, atol=1e-8, what="the gradient")
    close(np.sum(grad), 0.0, atol=1e-12, what="the sum of all gradient entries")


@check("properties", "the inputs are not changed", "The functions must not write into the embeddings or the logits.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(4)
    img = rng.normal(size=(3, 4))
    txt = rng.normal(size=(3, 4))
    logits = rng.normal(size=(3, 3))
    saved = [img.copy(), txt.copy(), logits.copy()]
    sub.similarity_logits(img, txt, 0.5)
    sub.symmetric_infonce(logits)
    sub.symmetric_infonce_grad(logits)
    for name, before, after in zip(["image_emb", "text_emb", "logits"], saved, [img, txt, logits]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "one pair", "With N = 1 each softmax has one item, so the loss is 0 and the gradient is 0.")
def one_pair(sub):
    logits = sub.similarity_logits(np.array([[3.0, 4.0]]), np.array([[1.0, 0.0]]), 0.2)
    close(logits, [[3.0]], rtol=1e-12, what="the logits")
    close(sub.symmetric_infonce(logits), 0.0, atol=1e-12, what="the loss")
    close(sub.symmetric_infonce_grad(logits), [[0.0]], atol=1e-12, what="the gradient")


@check("edge", "large logits do not overflow", "exp(1000) is infinite in float64. Use a log-softmax that subtracts the maximum of each row and of each column.")
def large_logits(sub):
    close(sub.symmetric_infonce(np.array([[1000.0, 0.0], [0.0, 1000.0]])), 0.0, atol=1e-12, what="the loss of a confident correct batch")
    close(sub.symmetric_infonce(np.array([[0.0, 1000.0], [0.0, 0.0]])), 500.34657359027995, rtol=1e-12, what="the loss with one large wrong logit")
    grad = np.asarray(sub.symmetric_infonce_grad(np.array([[0.0, 1000.0], [0.0, 0.0]])))
    true(np.all(np.isfinite(grad)), "The gradient has NaN or infinite values", "finite values", grad)


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for n, d, tau in [(2, 3, 1.0), (4, 8, 0.07), (6, 5, 0.5), (8, 16, 0.1)]:
        img = rng.normal(size=(n, d))
        txt = rng.normal(size=(n, d))
        logits = ref.similarity_logits(img, txt, tau)
        yield {"image_emb": img, "text_emb": txt, "temperature": tau}, {"logits": logits, "loss": ref.symmetric_infonce(logits), "grad": ref.symmetric_infonce_grad(logits)}


@check("reference", "logits, loss and gradient match the reference on 4 random batches", "Your logits, loss and gradient agree with the reference solution for several batch sizes and temperatures.")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"N = {case['image_emb'].shape[0]} and temperature {case['temperature']}"
        logits = sub.similarity_logits(case["image_emb"], case["text_emb"], case["temperature"])
        close(logits, expected["logits"], rtol=1e-9, atol=1e-12, what=f"the logits for {label}")
        close(sub.symmetric_infonce(expected["logits"]), expected["loss"], rtol=1e-9, what=f"the loss for {label}")
        close(sub.symmetric_infonce_grad(expected["logits"]), expected["grad"], rtol=1e-8, atol=1e-12, what=f"the gradient for {label}")
