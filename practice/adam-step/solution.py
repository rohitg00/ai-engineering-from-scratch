import numpy as np


def init_adam_state(params):
    return {"m": np.zeros_like(params, dtype=float), "v": np.zeros_like(params, dtype=float), "t": 0}


def adam_step(params, grads, state, lr=0.001, beta1=0.9, beta2=0.999, epsilon=1e-8, weight_decay=0.0):
    t = state["t"] + 1
    m = beta1 * state["m"] + (1 - beta1) * grads
    v = beta2 * state["v"] + (1 - beta2) * grads ** 2
    m_hat = m / (1 - beta1 ** t)
    v_hat = v / (1 - beta2 ** t)
    new_params = params * (1 - weight_decay * lr)
    new_params = new_params - lr * m_hat / (np.sqrt(v_hat) + epsilon)
    return new_params, {"m": m, "v": v, "t": t}
