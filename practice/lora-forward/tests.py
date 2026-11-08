import numpy as np

from practice_check import check, close, equal, fixture, fixtures, shape, true

X = np.array([[1.0, 2.0, 0.0], [0.0, -1.0, 1.0]])
W = np.array([[0.5, -0.5, 1.0], [1.0, 0.0, 0.0]])
BIAS = np.array([0.1, -0.2])
A = np.array([[1.0, 0.0, 1.0], [0.0, 1.0, 0.0]])
B = np.array([[1.0, 0.5], [-1.0, 0.0]])


def random_layer(rng, n, d_in, d_out, rank):
    x = rng.normal(size=(n, d_in))
    w = rng.normal(size=(d_out, d_in))
    b = rng.normal(size=d_out)
    a = rng.normal(size=(rank, d_in))
    bb = rng.normal(size=(d_out, rank))
    return x, w, b, a, bb


@check("examples", "forward pass of the small layer", "The output is x W^T + b plus alpha / r times x A^T B^T. Here r = 2 and alpha = 4, so the adapter path is scaled by 2.")
def example_forward(sub):
    close(sub.lora_forward(X, W, BIAS, A, B, 4.0), [[3.6, -1.2], [2.6, -2.2]], what="the layer output")


@check("examples", "B = 0 gives the base output", "When B is zero, the adapter adds nothing. The output is x W^T + b.")
def example_zero_b(sub):
    close(sub.lora_forward(X, W, BIAS, A, np.zeros((2, 2)), 4.0), [[-0.4, 0.8], [1.6, -0.2]], what="the layer output with B = 0")


@check("examples", "merged weight of the small layer", "The merged weight is W + (alpha / r) B A. It has the shape of W.")
def example_merge(sub):
    close(sub.merge_lora(W, A, B, 4.0), [[2.5, 0.5, 3.0], [-1.0, 0.0, -2.0]], what="the merged weight")


@check("examples", "trainable parameters of a 4096 by 4096 layer at rank 8", "A has r times in_features values. B has out_features times r values. Only A and B train.")
def example_count(sub):
    equal(sub.count_trainable(4096, 4096, 8), 65536, what="the trainable parameter count")


@check("properties", "the merged layer gives the same output as the adapter", "x W'^T + b with the merged weight W' must equal the forward pass with the separate adapter.")
def merge_matches_forward(sub):
    rng = np.random.default_rng(0)
    x, w, b, a, bb = random_layer(rng, 5, 7, 4, 3)
    merged = sub.merge_lora(w, a, bb, 6.0)
    shape(merged, w.shape, what="the merged weight")
    close(x @ merged.T + b, sub.lora_forward(x, w, b, a, bb, 6.0), rtol=1e-9, atol=1e-9, what="the output of the merged layer")


@check("properties", "B = 0 gives the base output for any A", "B starts at zero in LoRA, so the layer starts with the behavior of the base model.")
def zero_b_property(sub):
    rng = np.random.default_rng(1)
    x, w, b, a, bb = random_layer(rng, 4, 6, 5, 2)
    close(sub.lora_forward(x, w, b, a, np.zeros_like(bb), 16.0), x @ w.T + b, rtol=1e-12, atol=1e-12, what="the output with B = 0")
    close(sub.merge_lora(w, a, np.zeros_like(bb), 16.0), w, rtol=0, atol=0, what="the merged weight with B = 0")


@check("properties", "the adapter path is linear in alpha", "The adapter output is alpha / r times x A^T B^T. Double alpha and the change from the base output doubles.")
def linear_in_alpha(sub):
    rng = np.random.default_rng(2)
    x, w, b, a, bb = random_layer(rng, 3, 5, 4, 4)
    base = x @ w.T + b
    one = sub.lora_forward(x, w, b, a, bb, 8.0) - base
    two = sub.lora_forward(x, w, b, a, bb, 16.0) - base
    close(two, 2.0 * one, rtol=1e-9, atol=1e-12, what="the adapter change at double alpha")


@check("properties", "alpha equal to r gives scale 1", "With alpha = r the scale alpha / r is 1, so the adapter adds exactly x A^T B^T.")
def alpha_equals_rank(sub):
    rng = np.random.default_rng(3)
    x, w, b, a, bb = random_layer(rng, 3, 6, 2, 3)
    close(sub.lora_forward(x, w, b, a, bb, 3.0), x @ w.T + b + x @ a.T @ bb.T, rtol=1e-9, atol=1e-12, what="the layer output")


@check("properties", "the inputs are not changed", "merge_lora returns a new array. It must not write into the frozen weight W.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(4)
    x, w, b, a, bb = random_layer(rng, 2, 4, 3, 2)
    saved = [arr.copy() for arr in (x, w, b, a, bb)]
    sub.lora_forward(x, w, b, a, bb, 4.0)
    sub.merge_lora(w, a, bb, 4.0)
    for name, arr, old in zip(("x", "W", "b", "A", "B"), (x, w, b, a, bb), saved):
        close(arr, old, rtol=0, atol=0, what=f"{name} after the calls")


@check("edge", "rank 1 adapter on a wide layer", "The rank is the number of rows of A. A rank 1 adapter is an outer product.")
def rank_one(sub):
    x = np.ones((1, 4))
    w = np.zeros((3, 4))
    b = np.zeros(3)
    a = np.array([[1.0, 1.0, 1.0, 1.0]])
    bb = np.array([[1.0], [2.0], [3.0]])
    close(sub.lora_forward(x, w, b, a, bb, 0.5), [[2.0, 4.0, 6.0]], what="the rank 1 output")


@check("edge", "rank larger than the output size", "Read the rank from A, not from W. Here r = 4 and the layer has 2 outputs and 3 inputs.")
def rank_from_a(sub):
    rng = np.random.default_rng(5)
    x, w, b, a, bb = random_layer(rng, 2, 3, 2, 4)
    close(sub.lora_forward(x, w, b, a, bb, 2.0), x @ w.T + b + 0.5 * (x @ a.T @ bb.T), rtol=1e-9, atol=1e-12, what="the layer output")


@check("edge", "counts for a non square layer", "in_features and out_features are different here. A is (r, in_features) and B is (out_features, r).")
def count_non_square(sub):
    equal(sub.count_trainable(768, 3072, 16), 61440, what="the count for 768 inputs, 3072 outputs, rank 16")
    equal(sub.count_trainable(3, 2, 2), 10, what="the count for 3 inputs, 2 outputs, rank 2")


@fixture("layers")
def layers(ref):
    rng = np.random.default_rng(42)
    for n, d_in, d_out, rank, alpha in [(1, 4, 3, 1, 1.0), (3, 6, 5, 2, 16.0), (4, 8, 8, 4, 8.0), (2, 5, 9, 3, 32.0)]:
        x, w, b, a, bb = random_layer(rng, n, d_in, d_out, rank)
        yield {"x": x, "W": w, "b": b, "A": a, "B": bb, "alpha": alpha}, {
            "y": ref.lora_forward(x, w, b, a, bb, alpha),
            "merged": ref.merge_lora(w, a, bb, alpha),
            "count": ref.count_trainable(d_in, d_out, rank),
        }


@check("reference", "outputs, merged weights and counts match the reference", "Your three functions agree with the reference solution on random layers of several sizes and ranks.")
def reference_layers(sub):
    for case, expected in fixtures("layers"):
        label = f"a layer with W of shape {case['W'].shape} and rank {case['A'].shape[0]}"
        close(sub.lora_forward(case["x"], case["W"], case["b"], case["A"], case["B"], case["alpha"]), expected["y"], rtol=1e-9, atol=1e-12, what=f"the output for {label}")
        close(sub.merge_lora(case["W"], case["A"], case["B"], case["alpha"]), expected["merged"], rtol=1e-9, atol=1e-12, what=f"the merged weight for {label}")
        equal(sub.count_trainable(case["W"].shape[1], case["W"].shape[0], case["A"].shape[0]), expected["count"], what=f"the count for {label}")
