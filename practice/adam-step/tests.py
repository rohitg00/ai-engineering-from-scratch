import numpy as np

from practice_check import check, close, equal, fixture, fixtures, true

P0 = np.array([1.0, -2.0, 0.5])
G0 = np.array([0.1, -0.3, 2.0])
G1 = np.array([0.2, 0.1, -1.0])


def state_of(sub, params):
    state = sub.init_adam_state(params)
    true(isinstance(state, dict) and {"m", "v", "t"} <= set(state), "init_adam_state must return a dict with the keys m, v and t", "{'m': ..., 'v': ..., 't': 0}", state)
    return state


@check("examples", "the start state", "The state starts with m and v as zero arrays with the shape of params, and t equal to 0.")
def example_init(sub):
    state = state_of(sub, P0)
    close(state["m"], [0.0, 0.0, 0.0], what="m")
    close(state["v"], [0.0, 0.0, 0.0], what="v")
    equal(state["t"], 0, what="t")


@check("examples", "the first Adam step", "The first step uses t = 1 in the bias correction. Then m hat is the gradient and v hat is the gradient squared.")
def example_first(sub):
    params, state = sub.adam_step(P0, G0, state_of(sub, P0), lr=0.1)
    close(params, [0.90000001, -1.9, 0.4], what="the parameters after one step")
    close(state["m"], [0.01, -0.03, 0.2], what="m after one step")
    close(state["v"], [1e-05, 9e-05, 4e-03], what="v after one step")
    equal(state["t"], 1, what="t after one step")


@check("examples", "the second Adam step", "The second step uses t = 2. The moments keep their history from the first step.")
def example_second(sub):
    params, state = sub.adam_step(P0, G0, state_of(sub, P0), lr=0.1)
    params, state = sub.adam_step(params, G1, state, lr=0.1)
    close(params, [0.80348181, -1.85997815, 0.3733663], what="the parameters after two steps")
    close(state["m"], [0.029, -0.017, 0.08], what="m after two steps")
    close(state["v"], [4.999e-05, 9.991e-05, 4.996e-03], what="v after two steps")
    equal(state["t"], 2, what="t after two steps")


@check("examples", "the first AdamW step", "AdamW first multiplies the parameters by 1 minus lr times weight_decay. Then it subtracts the Adam update.")
def example_adamw(sub):
    params, _ = sub.adam_step(P0, G0, state_of(sub, P0), lr=0.1, weight_decay=0.5)
    close(params, [0.85000001, -1.8, 0.375], what="the parameters after one AdamW step")


@check("properties", "bias correction removes the start bias", "With the same gradient g at every step, m hat equals g and v hat equals g squared at every step. So each step moves by lr times g divided by (abs(g) plus epsilon).")
def constant_gradient(sub):
    grads = np.array([0.5, -0.02, 3.0])
    params = np.zeros(3)
    state = state_of(sub, params)
    step = 0.01 * grads / (np.abs(grads) + 1e-8)
    for k in range(1, 6):
        new_params, state = sub.adam_step(params, grads, state, lr=0.01)
        close(params - new_params, step, rtol=1e-9, what=f"the change of the parameters at step {k}")
        params = new_params


@check("properties", "the state follows the moment formulas", "m is beta1 times the old m plus (1 minus beta1) times g. v is beta2 times the old v plus (1 minus beta2) times g squared. t grows by 1.")
def moment_formulas(sub):
    rng = np.random.default_rng(5)
    params = rng.normal(size=(2, 3))
    state = {"m": rng.normal(size=(2, 3)), "v": rng.random(size=(2, 3)), "t": 7}
    grads = rng.normal(size=(2, 3))
    _, new_state = sub.adam_step(params, grads, state, lr=0.01, beta1=0.8, beta2=0.95)
    close(new_state["m"], 0.8 * state["m"] + 0.2 * grads, what="the new m")
    close(new_state["v"], 0.95 * state["v"] + 0.05 * grads ** 2, what="the new v")
    equal(new_state["t"], 8, what="the new t")


@check("properties", "weight decay is decoupled from the gradient", "With a zero gradient the Adam update is 0. AdamW then only multiplies the parameters by 1 minus lr times weight_decay. Do not add the decay to the gradient.")
def decoupled_decay(sub):
    params = np.array([4.0, -2.0, 1.0])
    new_params, _ = sub.adam_step(params, np.zeros(3), state_of(sub, params), lr=0.1, weight_decay=0.2)
    close(new_params, params * (1 - 0.1 * 0.2), rtol=1e-12, what="the parameters after a decay step with zero gradient")


@check("properties", "the inputs are not changed", "adam_step returns new arrays and a new state. It must not write into params, grads or the arrays of the old state.")
def inputs_unchanged(sub):
    params = np.array([1.0, 2.0, 3.0])
    grads = np.array([0.3, -0.2, 0.1])
    state = {"m": np.array([0.1, 0.1, 0.1]), "v": np.array([0.2, 0.2, 0.2]), "t": 3}
    saved = (params.copy(), grads.copy(), state["m"].copy(), state["v"].copy())
    sub.adam_step(params, grads, state, lr=0.1, weight_decay=0.1)
    close(params, saved[0], atol=0, rtol=0, what="params after the call")
    close(grads, saved[1], atol=0, rtol=0, what="grads after the call")
    close(state["m"], saved[2], atol=0, rtol=0, what="the old m after the call")
    close(state["v"], saved[3], atol=0, rtol=0, what="the old v after the call")
    equal(state["t"], 3, what="the old t after the call")


@check("edge", "a zero gradient gives no step and no NaN", "At the first step with g = 0, m hat and v hat are 0. The update is 0 divided by epsilon, which is 0.")
def zero_gradient(sub):
    params = np.array([[1.0, -1.0], [0.0, 2.0]])
    new_params, state = sub.adam_step(params, np.zeros((2, 2)), state_of(sub, params), lr=0.1)
    close(new_params, params, atol=0, rtol=0, what="the parameters after a zero gradient step")
    close(state["v"], np.zeros((2, 2)), what="v after a zero gradient step")


@check("edge", "a tiny gradient still moves by about lr", "Adam divides by the square root of v hat plus epsilon, with epsilon outside the square root. A gradient of 1e-6 then moves the parameter by 0.99 times lr.")
def tiny_gradient(sub):
    params = np.array([0.0])
    new_params, _ = sub.adam_step(params, np.array([1e-6]), state_of(sub, params), lr=0.1)
    close(new_params, [-0.1 * 1e-6 / (1e-6 + 1e-8)], rtol=1e-9, what="the parameter after one step with a tiny gradient")


@fixture("runs")
def runs(ref):
    rng = np.random.default_rng(21)
    for shp, lr, beta1, beta2, decay in [((3,), 0.01, 0.9, 0.999, 0.0), ((2, 2), 0.1, 0.8, 0.99, 0.0), ((4,), 0.001, 0.95, 0.9, 0.01), ((5,), 0.05, 0.9, 0.999, 0.3)]:
        params = rng.normal(size=shp)
        grads = [rng.normal(size=shp) * rng.choice([0.01, 1.0, 10.0]) for _ in range(4)]
        state = ref.init_adam_state(params)
        out = []
        p = params
        for g in grads:
            p, state = ref.adam_step(p, g, state, lr=lr, beta1=beta1, beta2=beta2, weight_decay=decay)
            out.append({"params": p, "m": state["m"], "v": state["v"], "t": state["t"]})
        yield {"params": params, "grads": grads, "lr": lr, "beta1": beta1, "beta2": beta2, "weight_decay": decay}, out


@check("reference", "four steps match the reference", "Your parameters and state agree with the reference after each of 4 steps, for Adam and AdamW with many settings.")
def reference_runs(sub):
    for case, expected in fixtures("runs"):
        params = case["params"]
        state = sub.init_adam_state(params)
        for k, (g, want) in enumerate(zip(case["grads"], expected), start=1):
            params, state = sub.adam_step(params, g, state, lr=case["lr"], beta1=case["beta1"], beta2=case["beta2"], weight_decay=case["weight_decay"])
            label = f"step {k} with lr {case['lr']} and weight_decay {case['weight_decay']}"
            close(params, want["params"], rtol=1e-9, atol=1e-12, what=f"the parameters at {label}")
            close(state["m"], want["m"], rtol=1e-9, atol=1e-12, what=f"m at {label}")
            close(state["v"], want["v"], rtol=1e-9, atol=1e-15, what=f"v at {label}")
            equal(state["t"], want["t"], what=f"t at {label}")
