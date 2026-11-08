import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

X0 = np.array([[0.0, 1.0], [2.0, -1.0]])
X1 = np.array([[1.0, 1.0], [0.0, 3.0]])
T2 = np.array([0.25, 0.5])


def half_x(x, t):
    return 0.5 * x


def linear_field(x, t):
    return -0.3 * x + np.sin(3.0 * t).reshape((-1,) + (1,) * (x.ndim - 1))


@check("examples", "interpolation and target velocity of two pairs", "x_t is (1 - t) times x0 plus t times x1, with one t for each row. The target velocity is x1 minus x0.")
def example_interp(sub):
    close(sub.interpolate(X0, X1, T2), [[0.25, 1.0], [1.0, 1.0]], rtol=1e-12, what="x_t")
    close(sub.target_velocity(X0, X1), [[1.0, 0.0], [-2.0, 4.0]], rtol=1e-12, what="the target velocity")


@check("examples", "the flow matching loss of v(x, t) = 0.5 x", "Evaluate the velocity at x_t. For each sample, sum the squared error over the feature axes. Then take the mean over the batch.")
def example_loss(sub):
    close(sub.flow_matching_loss(half_x, X0, X1, T2), 9.7578125, rtol=1e-12, what="the loss")


@check("examples", "Euler steps on dx/dt = x and dx/dt = t", "Step k reads the velocity at t = k / n and moves x by 1 / n times that velocity. With v = x and 4 steps, x grows by 1.25 four times. With v = t, x is (0 + 0.25 + 0.5 + 0.75) / 4.")
def example_euler(sub):
    close(sub.euler_sample(lambda x, t: x, np.array([[1.0]]), 4), [[2.44140625]], rtol=1e-12, what="the sample for v = x")
    close(sub.euler_sample(lambda x, t: np.ones_like(x) * t[:, None], np.array([[0.0]]), 4), [[0.375]], rtol=1e-12, what="the sample for v = t")


@check("properties", "the path starts at x0 and ends at x1", "At t = 0 the interpolation is x0. At t = 1 it is x1. A scalar t applies to every row.")
def endpoints(sub):
    rng = np.random.default_rng(0)
    x0 = rng.normal(size=(3, 2, 2))
    x1 = rng.normal(size=(3, 2, 2))
    close(sub.interpolate(x0, x1, 0.0), x0, atol=1e-12, what="x_t at t = 0")
    close(sub.interpolate(x0, x1, 1.0), x1, atol=1e-12, what="x_t at t = 1")
    mixed = sub.interpolate(x0, x1, np.array([0.0, 1.0, 0.5]))
    shape(mixed, (3, 2, 2), what="x_t with one t for each row")
    close(np.asarray(mixed)[2], (x0[2] + x1[2]) / 2, atol=1e-12, what="the midpoint of row 2")


@check("properties", "the exact straight velocity gives a loss of 0", "On a straight path the velocity is constant and equal to x1 minus x0. A velocity function that returns this value has zero loss at every t.")
def exact_velocity_zero_loss(sub):
    rng = np.random.default_rng(1)
    x0 = rng.normal(size=(5, 3))
    x1 = rng.normal(size=(5, 3))
    t = rng.random(5)
    close(sub.flow_matching_loss(lambda x, tt: x1 - x0, x0, x1, t), 0.0, atol=1e-12, what="the loss of the exact velocity")
    close(sub.flow_matching_loss(lambda x, tt: np.zeros_like(x), x0, x1, t), float(np.mean(np.sum((x1 - x0) ** 2, axis=1))), rtol=1e-12, what="the loss of the zero velocity")


@check("properties", "Euler with the exact straight velocity reaches x1", "Euler steps are exact on a straight line. With v = x1 - x0 the sampler reaches x1 for any number of steps, even 1.")
def euler_reaches_x1(sub):
    rng = np.random.default_rng(2)
    x0 = rng.normal(size=(4, 3))
    x1 = rng.normal(size=(4, 3))
    for n in [1, 3, 10]:
        close(sub.euler_sample(lambda x, t: x1 - x0, x0, n), x1, atol=1e-12, what=f"the sample after {n} steps")
    pull = lambda x, t: (x1 - x) / (1.0 - t)[:, None]
    close(sub.euler_sample(pull, x0, 5), x1, atol=1e-10, what="the sample for v = (x1 - x) / (1 - t)")


@check("properties", "the sampler passes one t for each row", "The velocity function gets x with shape (B, ...) and t with shape (B,). Every row of t holds the same time k / n.")
def euler_time_arg(sub):
    seen = []

    def record(x, t):
        seen.append(np.array(t, dtype=float))
        return np.zeros_like(x)

    sub.euler_sample(record, np.zeros((3, 2)), 4)
    true(len(seen) == 4, "The sampler must call the velocity function once for each step", 4, len(seen))
    for k, t in enumerate(seen):
        close(t, np.full(3, k / 4), atol=1e-12, what=f"t at step {k}")


@check("properties", "the inputs are not changed", "The sampler must start from a copy of x0. An update in place changes the array of the caller.")
def inputs_unchanged(sub):
    rng = np.random.default_rng(3)
    x0 = rng.normal(size=(3, 2))
    x1 = rng.normal(size=(3, 2))
    t = rng.random(3)
    saved = [x0.copy(), x1.copy(), t.copy()]
    sub.interpolate(x0, x1, t)
    sub.flow_matching_loss(half_x, x0, x1, t)
    sub.euler_sample(half_x, x0, 3)
    for name, before, after in zip(["x0", "x1", "t"], saved, [x0, x1, t]):
        true(np.array_equal(before, after), f"The function changed {name}", before, after)


@check("edge", "one sample with many feature axes", "The loss sums the squared error over every axis after the first, then takes the mean over the batch.")
def one_sample(sub):
    x0 = np.zeros((1, 2, 2))
    x1 = np.ones((1, 2, 2))
    close(sub.flow_matching_loss(lambda x, t: np.zeros_like(x), x0, x1, np.array([0.3])), 4.0, rtol=1e-12, what="the loss")


@check("edge", "integer input to the sampler", "The sampler must work in float even when x0 holds integers.")
def integer_input(sub):
    close(sub.euler_sample(lambda x, t: 0.5 * np.ones_like(x), np.array([[1, 2]]), 2), [[1.5, 2.5]], rtol=1e-12, what="the sample")


@fixture("cases")
def cases(ref):
    rng = np.random.default_rng(42)
    for b, feat, n in [(1, (1,), 1), (4, (3,), 2), (3, (2, 2), 5), (6, (4,), 8)]:
        x0 = rng.normal(size=(b,) + feat)
        x1 = rng.normal(size=(b,) + feat)
        t = rng.random(b)
        yield {"x0": x0, "x1": x1, "t": t, "steps": n}, {"x_t": ref.interpolate(x0, x1, t), "loss": ref.flow_matching_loss(linear_field, x0, x1, t), "sample": ref.euler_sample(linear_field, x0, n)}


@check("reference", "interpolation, loss and sampler match the reference on 4 cases", "Your x_t, loss and Euler sample agree with the reference for the field v(x, t) = -0.3 x + sin(3 t).")
def reference_cases(sub):
    for case, expected in fixtures("cases"):
        label = f"x0 of shape {case['x0'].shape} and {case['steps']} steps"
        close(sub.interpolate(case["x0"], case["x1"], case["t"]), expected["x_t"], rtol=1e-12, atol=1e-12, what=f"x_t for {label}")
        close(sub.flow_matching_loss(linear_field, case["x0"], case["x1"], case["t"]), expected["loss"], rtol=1e-10, what=f"the loss for {label}")
        close(sub.euler_sample(linear_field, case["x0"], case["steps"]), expected["sample"], rtol=1e-10, atol=1e-12, what=f"the sample for {label}")
