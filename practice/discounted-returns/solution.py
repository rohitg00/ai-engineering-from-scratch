import numpy as np


def returns_to_go(rewards, gamma):
    rewards = np.asarray(rewards, dtype=float)
    out = np.zeros_like(rewards)
    G = 0.0
    for t in reversed(range(rewards.shape[0])):
        G = rewards[t] + gamma * G
        out[t] = G
    return out


def batch_returns(rewards, dones, gamma):
    rewards = np.asarray(rewards, dtype=float)
    dones = np.asarray(dones, dtype=bool)
    out = np.zeros_like(rewards)
    G = 0.0
    for t in reversed(range(rewards.shape[0])):
        if dones[t]:
            G = 0.0
        G = rewards[t] + gamma * G
        out[t] = G
    return out


def normalize(returns):
    returns = np.asarray(returns, dtype=float)
    if returns.shape[0] < 2:
        return returns.copy()
    mean = np.mean(returns)
    std = np.std(returns)
    return (returns - mean) / (std + 1e-8)
