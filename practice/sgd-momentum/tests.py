import numpy as np

from practice_check import check, close, fixture, fixtures, shape, true

A = np.array([[3.0, 0.0], [0.0, 1.0]])
B = np.array([3.0, -1.0])
X0 = np.array([0.0, 0.0])


def spd(rng, d):
    q = rng.normal(size=(d, d))
    return q @ q.T / d + 0.5 * np.eye(d)


@check("examples", "one momentum step", "The new velocity is beta times the old velocity plus the gradient. The parameters then move by lr times the new velocity.")
def example_step(sub):
    params, velocity = sub.momentum_step(np.array([1.0, -2.0]), np.array([0.5, 0.5]), np.array([1.0, 0.0]), lr=0.1, beta=0.9)
    close(params, [0.86, -2.05], what="the new parameters")
    close(velocity, [1.4, 0.5], what="the new velocity")


@check("examples", "three steps on the example quadratic", "The trajectory starts with x0. Each row after it is the point after one more momentum step with the gradient A x minus b.")
def example_trajectory(sub):
    expected = [[0.0, 0.0], [0.3, -0.1], [0.78, -0.28], [1.278, -0.514]]
    close(sub.minimize_quadratic(A, B, X0, lr=0.1, beta=0.9, steps=3), expected, what="the trajectory")


@check("examples", "three Nesterov steps on the example quadratic", "Nesterov momentum computes the gradient at the lookahead point x minus lr times beta times the velocity.")
def example_nesterov(sub):
    expected = [[0.0, 0.0], [0.3, -0.1], [0.699, -0.271], [1.04067, -0.48241]]
    close(sub.minimize_quadratic(A, B, X0, lr=0.1, beta=0.9, steps=3, nesterov=True), expected, what="the Nesterov trajectory")


@check("properties", "beta 0 is plain gradient descent", "With beta equal to 0, the velocity is the gradient, so the step is params minus lr times the gradient.")
def beta_zero(sub):
    rng = np.random.default_rng(3)
    params = rng.normal(size=(3, 2))
    grads = rng.normal(size=(3, 2))
    new_params, velocity = sub.momentum_step(params, grads, rng.normal(size=(3, 2)), lr=0.05, beta=0.0)
    close(new_params, params - 0.05 * grads, what="the parameters for beta 0")
    close(velocity, grads, what="the velocity for beta 0")


@check("properties", "a constant gradient builds a geometric velocity", "After k steps with the same gradient g, the velocity is g times (1 minus beta to the k) divided by (1 minus beta). The lesson does not scale the gradient by 1 minus beta.")
def geometric_velocity(sub):
    grads = np.array([2.0, -1.0])
    params = np.zeros(2)
    velocity = np.zeros(2)
    for _ in range(5):
        params, velocity = sub.momentum_step(params, grads, velocity, lr=0.1, beta=0.8)
    close(velocity, grads * (1 - 0.8 ** 5) / (1 - 0.8), what="the velocity after 5 steps")


@check("properties", "the trajectory reaches the minimum", "The minimum of the quadratic solves A x = b. With a small learning rate the trajectory must end there.")
def converges(sub):
    rng = np.random.default_rng(4)
    a = spd(rng, 3)
    b = rng.normal(size=3)
    for nesterov in (False, True):
        path = sub.minimize_quadratic(a, b, np.zeros(3), lr=0.1, beta=0.8, steps=300, nesterov=nesterov)
        shape(path, (301, 3), what="the trajectory")
        close(path[-1], np.linalg.solve(a, b), atol=1e-6, what=f"the last point with nesterov={nesterov}")


@check("properties", "the inputs are not changed", "The step returns new arrays. It must not write into params, grads, velocity or x0.")
def inputs_unchanged(sub):
    params = np.array([1.0, 2.0])
    grads = np.array([0.5, -0.5])
    velocity = np.array([0.1, 0.2])
    x0 = np.array([0.5, 0.5])
    saved = [params.copy(), grads.copy(), velocity.copy(), x0.copy()]
    sub.momentum_step(params, grads, velocity, lr=0.1, beta=0.9)
    sub.minimize_quadratic(A, B, x0, lr=0.1, beta=0.9, steps=4)
    for name, before, after in zip(["params", "grads", "velocity", "x0"], saved, [params, grads, velocity, x0]):
        close(after, before, atol=0, rtol=0, what=f"{name} after the calls")


@check("edge", "zero steps returns only the start", "The trajectory has steps plus 1 rows. With steps equal to 0 it holds only x0.")
def zero_steps(sub):
    path = sub.minimize_quadratic(A, B, np.array([2.0, 5.0]), lr=0.1, beta=0.9, steps=0)
    close(path, [[2.0, 5.0]], what="the trajectory for 0 steps")


@check("edge", "a start at the minimum does not move", "At the minimum the gradient is 0 and the velocity starts at 0, so every point stays the same.")
def start_at_minimum(sub):
    for nesterov in (False, True):
        path = sub.minimize_quadratic(A, B, np.array([1.0, -1.0]), lr=0.1, beta=0.9, steps=5, nesterov=nesterov)
        close(path, np.tile([1.0, -1.0], (6, 1)), atol=1e-12, what=f"the trajectory with nesterov={nesterov}")


@check("edge", "Nesterov with beta 0 is plain gradient descent", "With beta equal to 0 the lookahead point is x itself, so both methods give the same trajectory.")
def nesterov_beta_zero(sub):
    a = np.array([[2.0]])
    b = np.array([4.0])
    plain = sub.minimize_quadratic(a, b, np.array([0.0]), lr=0.2, beta=0.0, steps=6)
    ahead = sub.minimize_quadratic(a, b, np.array([0.0]), lr=0.2, beta=0.0, steps=6, nesterov=True)
    shape(plain, (7, 1), what="the trajectory for a 1 by 1 problem")
    close(ahead, plain, what="the Nesterov trajectory for beta 0")
    true(abs(plain[-1, 0] - 2.0) < abs(plain[1, 0] - 2.0), "the trajectory did not move toward the minimum x = 2", 2.0, plain[-1, 0])


@fixture("steps")
def steps(ref):
    rng = np.random.default_rng(11)
    for shp, lr, beta in [((4,), 0.1, 0.9), ((2, 3), 0.01, 0.5), ((5,), 0.3, 0.99)]:
        params = rng.normal(size=shp)
        grads = rng.normal(size=shp)
        velocity = rng.normal(size=shp)
        yield {"params": params, "grads": grads, "velocity": velocity, "lr": lr, "beta": beta}, ref.momentum_step(params, grads, velocity, lr, beta)


@fixture("paths")
def paths(ref):
    rng = np.random.default_rng(12)
    for d, lr, beta, n, nesterov in [(2, 0.1, 0.9, 8, False), (3, 0.05, 0.7, 10, True), (4, 0.2, 0.5, 6, False), (3, 0.1, 0.95, 12, True)]:
        a = spd(rng, d)
        b = rng.normal(size=d)
        x0 = rng.normal(size=d)
        yield {"A": a, "b": b, "x0": x0, "lr": lr, "beta": beta, "steps": n, "nesterov": nesterov}, ref.minimize_quadratic(a, b, x0, lr, beta, n, nesterov)


@check("reference", "momentum steps match the reference", "Your step gives the same parameters and velocity as the reference on random arrays.")
def reference_steps(sub):
    for case, expected in fixtures("steps"):
        params, velocity = sub.momentum_step(case["params"], case["grads"], case["velocity"], lr=case["lr"], beta=case["beta"])
        close(params, expected[0], rtol=1e-9, what=f"the parameters for lr {case['lr']} and beta {case['beta']}")
        close(velocity, expected[1], rtol=1e-9, what=f"the velocity for lr {case['lr']} and beta {case['beta']}")


@check("reference", "trajectories match the reference", "Your trajectory gives the same points as the reference on random quadratics, with and without Nesterov.")
def reference_paths(sub):
    for case, expected in fixtures("paths"):
        path = sub.minimize_quadratic(case["A"], case["b"], case["x0"], lr=case["lr"], beta=case["beta"], steps=case["steps"], nesterov=case["nesterov"])
        close(path, expected, rtol=1e-9, atol=1e-12, what=f"the trajectory for nesterov={case['nesterov']} and beta {case['beta']}")
