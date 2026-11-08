import numpy as np


def td_errors(rewards, values, dones, gamma):
    rewards = np.asarray(rewards, dtype=float)
    values = np.asarray(values, dtype=float)
    not_done = 1.0 - np.asarray(dones, dtype=float)
    next_v = values[1:] * not_done
    return rewards + gamma * next_v - values[:-1]


def gae(rewards, values, dones, gamma, lam):
    rewards = np.asarray(rewards, dtype=float)
    values = np.asarray(values, dtype=float)
    dones = np.asarray(dones, dtype=bool)
    T = rewards.shape[0]
    advantages = np.zeros(T)
    gae_val = 0.0
    for t in reversed(range(T)):
        next_v = 0.0 if dones[t] else values[t + 1]
        delta = rewards[t] + gamma * next_v - values[t]
        if dones[t]:
            gae_val = 0.0
        gae_val = delta + gamma * lam * gae_val
        advantages[t] = gae_val
    returns = advantages + values[:T]
    return advantages, returns
