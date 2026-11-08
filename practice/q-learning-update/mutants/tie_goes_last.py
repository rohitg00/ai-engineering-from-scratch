import numpy as np


def q_learning_update(Q, s, a, r, s_next, done, alpha=0.1, gamma=0.99):
    Q = np.array(Q, dtype=float)
    best_next = 0.0 if done else np.max(Q[s_next])
    target = r + gamma * best_next
    Q[s, a] += alpha * (target - Q[s, a])
    return Q


def sarsa_update(Q, s, a, r, s_next, a_next, done, alpha=0.1, gamma=0.99):
    Q = np.array(Q, dtype=float)
    next_q = 0.0 if done else Q[s_next, a_next]
    target = r + gamma * next_q
    Q[s, a] += alpha * (target - Q[s, a])
    return Q


def epsilon_greedy(Q, s, epsilon, rng):
    q = np.asarray(Q)[s]
    if rng.random() < epsilon:
        return int(rng.integers(q.shape[0]))
    return int(q.shape[0] - 1 - np.argmax(q[::-1]))
